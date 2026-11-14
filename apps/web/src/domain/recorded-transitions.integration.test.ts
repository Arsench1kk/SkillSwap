import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { db, pool } from "@/db/client";
import type { DatabaseTransaction } from "@/db/types";
import {
  events,
  learnerRequests,
  mentorBriefs,
  mentorProfiles,
  stateTransitions,
} from "@/db/schema";
import { createParticipant } from "./participants";
import {
  transitionLearnerRequest,
  transitionMentorBrief,
  type TransitionActor,
} from "./state-machines";

type FixtureOptions = {
  requestStatus?: (typeof learnerRequests.$inferInsert)["status"];
  briefStatus?: (typeof mentorBriefs.$inferInsert)["status"];
};

async function createFixture(
  tx: DatabaseTransaction,
  options: FixtureOptions = {},
) {
  const learner = await createParticipant(tx, { role: "learner" });
  const mentor = await createParticipant(tx, { role: "mentor" });
  const stranger = await createParticipant(tx, { role: "learner" });
  const operator = await createParticipant(tx, { role: "operator" });
  await tx
    .insert(mentorProfiles)
    .values({ participantId: mentor.participantId });
  const [request] = await tx
    .insert(learnerRequests)
    .values({
      participantId: learner.participantId,
      taskCategory: "STEM",
      taskDescription: "SYNTHETIC STATE TEST",
      triedAlready: "SYNTHETIC ATTEMPT",
      deadlineAt: new Date(Date.now() + 5 * 86_400_000),
      preferredWindows: [],
      status: options.requestStatus ?? "draft",
    })
    .returning();
  const [brief] = await tx
    .insert(mentorBriefs)
    .values({
      requestId: request.id,
      mentorParticipantId: mentor.participantId,
      templateVersion: "atomic-brief-v1",
      sentAt: new Date(),
      answerBy: new Date(Date.now() + 86_400_000),
      status: options.briefStatus ?? "invited",
    })
    .returning();
  return { learner, mentor, stranger, operator, request, brief };
}

type Fixture = Awaited<ReturnType<typeof createFixture>>;

// Roll back fixtures, including successful append-only events, without DELETE.
async function withFixture(
  run: (tx: DatabaseTransaction, fixture: Fixture) => Promise<void>,
  options?: FixtureOptions,
) {
  const rollback = new Error("synthetic_fixture_rollback");
  try {
    await db.transaction(async (tx) => {
      await run(tx, await createFixture(tx, options));
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
}

function actor(participantId: string): TransitionActor {
  return { type: "participant", participantId };
}

async function assertNoWrites(tx: DatabaseTransaction, f: Fixture) {
  const rows = await tx
    .select()
    .from(stateTransitions)
    .where(inArray(stateTransitions.subjectId, [f.request.id, f.brief.id]));
  const ledger = await tx
    .select()
    .from(events)
    .where(
      inArray(events.participantId, [
        f.learner.participantId,
        f.mentor.participantId,
      ]),
    );
  expect(rows).toHaveLength(0);
  expect(ledger).toHaveLength(0);
}

describe.skipIf(!process.env.DATABASE_URL)(
  "atomic recorded transitions in PostgreSQL",
  () => {
    beforeEach(() => {
      vi.stubEnv("SKILLSWAP_DATA_ORIGIN", "rehearsal");
    });
    afterEach(() => {
      vi.unstubAllEnvs();
    });
    afterAll(async () => {
      await pool.end();
    });

    it("commits request state, audit and event with one server timestamp", async () => {
      await withFixture(async (tx, f) => {
        const at = new Date();
        const result = await transitionLearnerRequest(
          tx,
          f.request.id,
          "submitted",
          {
            actor: actor(f.learner.participantId),
            source: "L1",
            reasonCode: "request_submitted",
            at,
          },
          {
            input: {
              eventName: "request_submitted",
              timestampUtc: new Date(0),
            },
          },
        );
        expect(result.ok).toBe(true);
        const [request] = await tx
          .select()
          .from(learnerRequests)
          .where(eq(learnerRequests.id, f.request.id));
        const [audit] = await tx
          .select()
          .from(stateTransitions)
          .where(eq(stateTransitions.subjectId, f.request.id));
        const [event] = await tx
          .select()
          .from(events)
          .where(eq(events.participantId, f.learner.participantId));
        expect(request.status).toBe("submitted");
        expect(audit.toState).toBe("submitted");
        expect(event).toMatchObject({
          eventName: "request_submitted",
          participantId: f.learner.participantId,
          role: "learner",
          dataOrigin: "rehearsal",
          actor: null,
        });
        expect(event.timestampUtc).toEqual(at);
        expect(audit.transitionedAt).toEqual(at);
      });
    });

    it("rolls request and audit back when event input contains contact data", async () => {
      await withFixture(async (tx, f) => {
        await expect(
          transitionLearnerRequest(
            tx,
            f.request.id,
            "submitted",
            {
              actor: actor(f.learner.participantId),
              source: "L1",
              reasonCode: "request_submitted",
            },
            {
              input: {
                eventName: "request_submitted",
                note: "synthetic@example.test",
              },
            },
          ),
        ).rejects.toThrow();
        const [request] = await tx
          .select()
          .from(learnerRequests)
          .where(eq(learnerRequests.id, f.request.id));
        expect(request.status).toBe("draft");
        expect(request.updatedAt).toEqual(f.request.updatedAt);
        await assertNoWrites(tx, f);
      });
    });

    it("rolls back when PostgreSQL rejects the event insert after the audit write", async () => {
      await withFixture(async (tx, f) => {
        await expect(
          transitionLearnerRequest(
            tx,
            f.request.id,
            "submitted",
            {
              actor: actor(f.learner.participantId),
              source: "L1",
              reasonCode: "request_submitted",
            },
            {
              input: {
                eventName: "request_submitted",
                correctsEventId: randomUUID(),
              },
            },
          ),
        ).rejects.toThrow();
        const [request] = await tx
          .select()
          .from(learnerRequests)
          .where(eq(learnerRequests.id, f.request.id));
        expect(request.status).toBe("draft");
        await assertNoWrites(tx, f);
      });
    });

    it("rolls back rather than mislabelling production data without origin config", async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("SKILLSWAP_DATA_ORIGIN", undefined);
      await withFixture(async (tx, f) => {
        await expect(
          transitionLearnerRequest(
            tx,
            f.request.id,
            "submitted",
            {
              actor: actor(f.learner.participantId),
              source: "L1",
              reasonCode: "request_submitted",
            },
            { input: { eventName: "request_submitted" } },
          ),
        ).rejects.toThrow("SKILLSWAP_DATA_ORIGIN");
        const [request] = await tx
          .select()
          .from(learnerRequests)
          .where(eq(learnerRequests.id, f.request.id));
        expect(request.status).toBe("draft");
        await assertNoWrites(tx, f);
      });
    });

    it("denies another learner and a participant pretending to be an operator", async () => {
      await withFixture(async (tx, f) => {
        for (const unauthorized of [
          actor(f.stranger.participantId),
          { type: "operator", participantId: f.learner.participantId } as const,
        ]) {
          await expect(
            transitionLearnerRequest(
              tx,
              f.request.id,
              "cancelled",
              {
                actor: unauthorized,
                source: "L2",
                reasonCode: "learner_cancelled",
              },
              { input: { eventName: "request_cancelled" } },
            ),
          ).rejects.toThrow();
        }
        const [request] = await tx
          .select()
          .from(learnerRequests)
          .where(eq(learnerRequests.id, f.request.id));
        expect(request.status).toBe("draft");
        await assertNoWrites(tx, f);
      });
    });

    it("preserves subject identity and records the verified operator separately", async () => {
      await withFixture(async (tx, f) => {
        await transitionLearnerRequest(
          tx,
          f.request.id,
          "cancelled",
          {
            actor: {
              type: "operator",
              participantId: f.operator.participantId,
            },
            source: "operator_test",
            reasonCode: "operator_cancelled",
          },
          { input: { eventName: "request_cancelled" } },
        );
        const [event] = await tx
          .select()
          .from(events)
          .where(eq(events.participantId, f.learner.participantId));
        expect(event).toMatchObject({
          participantId: f.learner.participantId,
          role: "learner",
          actor: f.operator.participantId,
        });
      });
    });

    it("rejects server-owned fields smuggled into event input", async () => {
      await withFixture(async (tx, f) => {
        await expect(
          transitionLearnerRequest(
            tx,
            f.request.id,
            "submitted",
            {
              actor: actor(f.learner.participantId),
              source: "L1",
              reasonCode: "request_submitted",
            },
            {
              input: {
                eventName: "request_submitted",
                participantId: f.stranger.participantId,
                dataOrigin: "real_pilot",
              } as never,
            },
          ),
        ).rejects.toThrow();
        await assertNoWrites(tx, f);
      });
    });

    it("does not add an event for an illegal transition or change legacy callers", async () => {
      await withFixture(async (tx, f) => {
        expect(
          (
            await transitionLearnerRequest(
              tx,
              f.request.id,
              "completed",
              {
                actor: actor(f.learner.participantId),
                source: "test",
                reasonCode: "invalid_transition",
              },
              { input: { eventName: "session_completed" } },
            )
          ).ok,
        ).toBe(false);
        await assertNoWrites(tx, f);
        await transitionLearnerRequest(tx, f.request.id, "submitted", {
          actor: actor(f.learner.participantId),
          source: "L1",
          reasonCode: "request_submitted",
        });
        const ledger = await tx
          .select()
          .from(events)
          .where(eq(events.participantId, f.learner.participantId));
        expect(ledger).toHaveLength(0);
      });
    });

    it("atomically records a brief view with its stored template version", async () => {
      await withFixture(async (tx, f) => {
        await transitionMentorBrief(
          tx,
          f.brief.id,
          "viewed",
          {
            actor: actor(f.mentor.participantId),
            source: "M2",
            reasonCode: "mentor_opened_brief",
          },
          { input: { eventName: "mentor_viewed" } },
        );
        const [brief] = await tx
          .select()
          .from(mentorBriefs)
          .where(eq(mentorBriefs.id, f.brief.id));
        const [event] = await tx
          .select()
          .from(events)
          .where(eq(events.participantId, f.mentor.participantId));
        expect(brief.status).toBe("viewed");
        expect(event).toMatchObject({
          participantId: f.mentor.participantId,
          role: "mentor",
          eventName: "mentor_viewed",
          templateVersion: f.brief.templateVersion,
        });
      });
    });

    it("keeps a failed brief view retryable without losing mentor_viewed", async () => {
      await withFixture(async (tx, f) => {
        const context = {
          actor: actor(f.mentor.participantId),
          source: "M2",
          reasonCode: "mentor_opened_brief",
        };
        await expect(
          transitionMentorBrief(tx, f.brief.id, "viewed", context, {
            input: { eventName: "mentor_viewed", note: "@synthetic_contact" },
          }),
        ).rejects.toThrow();
        const [brief] = await tx
          .select()
          .from(mentorBriefs)
          .where(eq(mentorBriefs.id, f.brief.id));
        expect(brief.status).toBe("invited");
        await assertNoWrites(tx, f);
        await transitionMentorBrief(tx, f.brief.id, "viewed", context, {
          input: { eventName: "mentor_viewed" },
        });
        const ledger = await tx
          .select()
          .from(events)
          .where(eq(events.participantId, f.mentor.participantId));
        expect(ledger).toHaveLength(1);
      });
    });

    it("attributes learner confirmation to the learner using the brief version", async () => {
      await withFixture(
        async (tx, f) => {
          await transitionMentorBrief(
            tx,
            f.brief.id,
            "confirmed",
            {
              actor: actor(f.learner.participantId),
              source: "L3",
              reasonCode: "learner_confirmed_time",
            },
            { input: { eventName: "match_accepted" } },
          );
          const [event] = await tx
            .select()
            .from(events)
            .where(eq(events.participantId, f.learner.participantId));
          expect(event).toMatchObject({
            role: "learner",
            templateVersion: f.brief.templateVersion,
            eventName: "match_accepted",
          });
        },
        { requestStatus: "matched", briefStatus: "slot_proposed" },
      );
    });

    it("does not allow a learner to perform the mentor's response action", async () => {
      await withFixture(
        async (tx, f) => {
          await expect(
            transitionMentorBrief(
              tx,
              f.brief.id,
              "accepted",
              {
                actor: actor(f.learner.participantId),
                source: "M2",
                reasonCode: "invalid_actor",
              },
              { input: { eventName: "mentor_accepted" } },
            ),
          ).rejects.toThrow();
          await assertNoWrites(tx, f);
        },
        { briefStatus: "viewed" },
      );
    });

    it("records a single cancellation when requests compete on the same row", async () => {
      // This committed synthetic fixture exercises independent connections. Its
      // append-only event remains until the disposable integration DB is dropped.
      const f = await db.transaction((tx) => createFixture(tx));
      const results = await Promise.all(
        Array.from({ length: 4 }, () =>
          transitionLearnerRequest(
            db,
            f.request.id,
            "cancelled",
            {
              actor: actor(f.learner.participantId),
              source: "L2",
              reasonCode: "learner_cancelled",
            },
            { input: { eventName: "request_cancelled" } },
          ),
        ),
      );
      expect(results.filter((result) => result.ok)).toHaveLength(1);
      const ledger = await db
        .select()
        .from(events)
        .where(eq(events.participantId, f.learner.participantId));
      const audit = await db
        .select()
        .from(stateTransitions)
        .where(eq(stateTransitions.subjectId, f.request.id));
      expect(ledger).toHaveLength(1);
      expect(audit).toHaveLength(1);
    });
  },
);
