import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { db, pool } from "@/db/client";
import {
  events,
  learnerRequests,
  matches,
  mentorBriefs,
  mentorProfiles,
  stateTransitions,
} from "@/db/schema";
import { createParticipant } from "@/domain/participants";
import {
  toKazakhstanDateInput,
  toKazakhstanDateTimeInput,
} from "@/domain/time";
import {
  cancelLearnerRequest,
  confirmLearnerMatch,
  declineLearnerMatch,
  updateLearnerRequest,
} from "./request-actions";

// These tests write to the database named by DATABASE_URL. Use a disposable
// database: events and state_transitions are append-only and cannot be cleaned.
const databaseAvailable = Boolean(process.env.DATABASE_URL);
const dataOrigin = "rehearsal" as const;
const DAY = 86_400_000;

type Fixture = Awaited<ReturnType<typeof createFixture>>;

async function createFixture(
  options: {
    requestStatus?: (typeof learnerRequests.$inferSelect)["status"];
    withProposal?: boolean;
    briefStatus?: (typeof mentorBriefs.$inferSelect)["status"];
    matchStatus?: (typeof matches.$inferSelect)["status"];
  } = {},
) {
  const now = new Date();
  const learner = await createParticipant(db, {
    role: "learner",
    consentGivenAt: now,
  });
  const mentor = await createParticipant(db, {
    role: "mentor",
    consentGivenAt: now,
    yearOfStudy: 3,
  });
  await db.insert(mentorProfiles).values({
    participantId: mentor.participantId,
    displayName: "Mentor Test",
  });
  const slot = new Date(now.getTime() + 2 * DAY);
  const [request] = await db
    .insert(learnerRequests)
    .values({
      participantId: learner.participantId,
      taskCategory: "STEM",
      taskDescription: "Fix a chart that does not update.",
      triedAlready: "Refreshed the data.",
      deadlineAt: new Date(now.getTime() + 5 * DAY),
      preferredWindows: [
        {
          startUtc: slot.toISOString(),
          endUtc: new Date(slot.getTime() + 3_600_000).toISOString(),
        },
        {
          startUtc: new Date(slot.getTime() + DAY).toISOString(),
          endUtc: new Date(slot.getTime() + DAY + 3_600_000).toISOString(),
        },
      ],
      status:
        options.requestStatus ??
        (options.withProposal ? "matched" : "eligible"),
    })
    .returning();

  let brief: typeof mentorBriefs.$inferSelect | undefined;
  let match: typeof matches.$inferSelect | undefined;
  if (options.withProposal) {
    [brief] = await db
      .insert(mentorBriefs)
      .values({
        requestId: request.id,
        mentorParticipantId: mentor.participantId,
        templateVersion: "d2-test-v1",
        sentAt: now,
        answerBy: new Date(now.getTime() + 2 * DAY),
        status: options.briefStatus ?? "slot_proposed",
      })
      .returning();
    [match] = await db
      .insert(matches)
      .values({
        requestId: request.id,
        mentorParticipantId: mentor.participantId,
        humanDecision: "accepted",
        proposedSlotAt: slot,
        mentorAcceptedAt: now,
        status: options.matchStatus ?? "proposed",
      })
      .returning();
  }
  return { learner, mentor, request, brief, match, slot };
}

async function snapshot(fixture: Fixture) {
  const [request] = await db
    .select()
    .from(learnerRequests)
    .where(eq(learnerRequests.id, fixture.request.id));
  const [match] = fixture.match
    ? await db.select().from(matches).where(eq(matches.id, fixture.match.id))
    : [];
  const [brief] = fixture.brief
    ? await db
        .select()
        .from(mentorBriefs)
        .where(eq(mentorBriefs.id, fixture.brief.id))
    : [];
  const eventRows = await db
    .select()
    .from(events)
    .where(eq(events.participantId, fixture.learner.participantId));
  const transitions = await db
    .select()
    .from(stateTransitions)
    .where(eq(stateTransitions.subjectId, fixture.request.id));
  return { request, match, brief, eventRows, transitions };
}

const names = (rows: { eventName: string }[]) =>
  rows.map((row) => row.eventName);
const context = (fixture: Fixture) => ({
  requestId: fixture.request.id,
  dataOrigin,
});

describe.skipIf(!databaseAvailable)("learner request actions", () => {
  afterAll(async () => {
    await pool.end();
  });

  describe("confirm", () => {
    it("confirms once: request scheduled, match accepted, brief confirmed, one event", async () => {
      const fixture = await createFixture({ withProposal: true });
      await expect(confirmLearnerMatch(db, context(fixture))).resolves.toEqual({
        ok: true,
      });

      const state = await snapshot(fixture);
      expect(state.request.status).toBe("session_scheduled");
      expect(state.match?.status).toBe("accepted");
      expect(state.match?.learnerAcceptedAt).toBeInstanceOf(Date);
      expect(state.brief?.status).toBe("confirmed");
      const accepted = state.eventRows.filter(
        (row) => row.eventName === "match_accepted",
      );
      expect(accepted).toHaveLength(1);
      expect(accepted[0].templateVersion).toBe("d2-test-v1");
      expect(accepted[0].dataOrigin).toBe(dataOrigin);
    });

    it("lets exactly one of two concurrent confirms win", async () => {
      const fixture = await createFixture({ withProposal: true });
      const results = await Promise.all([
        confirmLearnerMatch(db, context(fixture)),
        confirmLearnerMatch(db, context(fixture)),
      ]);
      expect(results.filter((result) => result.ok)).toHaveLength(1);
      expect(results.filter((result) => !result.ok)).toEqual([
        { ok: false, error: "state_changed" },
      ]);

      const state = await snapshot(fixture);
      expect(
        names(state.eventRows).filter((n) => n === "match_accepted"),
      ).toHaveLength(1);
      expect(
        state.transitions.filter((row) => row.toState === "session_scheduled"),
      ).toHaveLength(1);
    });

    it("refuses a repeated confirm after success without touching anything", async () => {
      const fixture = await createFixture({ withProposal: true });
      await confirmLearnerMatch(db, context(fixture));
      const before = await snapshot(fixture);
      await expect(confirmLearnerMatch(db, context(fixture))).resolves.toEqual({
        ok: false,
        error: "state_changed",
      });
      const after = await snapshot(fixture);
      expect(after.eventRows).toHaveLength(before.eventRows.length);
      expect(after.transitions).toHaveLength(before.transitions.length);
    });

    it("refuses to confirm a proposal the mentor already withdrew", async () => {
      const fixture = await createFixture({
        withProposal: true,
        briefStatus: "withdrawn",
        matchStatus: "withdrawn",
      });
      await expect(confirmLearnerMatch(db, context(fixture))).resolves.toEqual({
        ok: false,
        error: "state_changed",
      });
      const state = await snapshot(fixture);
      expect(state.request.status).toBe("matched");
      expect(state.match?.status).toBe("withdrawn");
      expect(names(state.eventRows)).not.toContain("match_accepted");
    });

    it("refuses to confirm a cancelled request", async () => {
      const fixture = await createFixture({
        withProposal: true,
        requestStatus: "cancelled",
      });
      await expect(confirmLearnerMatch(db, context(fixture))).resolves.toEqual({
        ok: false,
        error: "state_changed",
      });
      expect((await snapshot(fixture)).match?.status).toBe("proposed");
    });

    it("refuses to confirm an older match once a newer one exists", async () => {
      const fixture = await createFixture({ withProposal: true });
      await db.insert(matches).values({
        requestId: fixture.request.id,
        mentorParticipantId: fixture.mentor.participantId,
        humanDecision: "pending",
        createdAt: new Date(Date.now() + 1000),
      });
      await expect(confirmLearnerMatch(db, context(fixture))).resolves.toEqual({
        ok: false,
        error: "state_changed",
      });
      const state = await snapshot(fixture);
      expect(state.request.status).toBe("matched");
      expect(state.brief?.status).toBe("slot_proposed");
    });

    it("refuses when no mentor proposal exists yet", async () => {
      const fixture = await createFixture({ requestStatus: "matching" });
      await expect(confirmLearnerMatch(db, context(fixture))).resolves.toEqual({
        ok: false,
        error: "state_changed",
      });
    });
  });

  describe("decline", () => {
    it("returns the request to matching and marks the match declined", async () => {
      const fixture = await createFixture({ withProposal: true });
      await expect(declineLearnerMatch(db, context(fixture))).resolves.toEqual({
        ok: true,
      });
      const state = await snapshot(fixture);
      expect(state.request.status).toBe("matching");
      expect(state.match?.status).toBe("declined");
      expect(state.match?.humanDecision).toBe("rejected");
      expect(names(state.eventRows)).toContain("match_declined");
    });

    it("does not overwrite a mentor withdrawal that happened first", async () => {
      // The page was rendered while the proposal stood; the mentor withdrew
      // afterwards. Declining must not turn "withdrawn" into "declined".
      const fixture = await createFixture({
        withProposal: true,
        briefStatus: "withdrawn",
        matchStatus: "withdrawn",
      });
      await expect(declineLearnerMatch(db, context(fixture))).resolves.toEqual({
        ok: false,
        error: "state_changed",
      });
      const state = await snapshot(fixture);
      expect(state.match?.status).toBe("withdrawn");
      expect(state.match?.humanDecision).toBe("accepted");
      expect(state.request.status).toBe("matched");
      expect(names(state.eventRows)).not.toContain("match_declined");
    });

    it("answers state_changed, not a server error, when the time is already confirmed", async () => {
      const fixture = await createFixture({ withProposal: true });
      await confirmLearnerMatch(db, context(fixture));
      await expect(declineLearnerMatch(db, context(fixture))).resolves.toEqual({
        ok: false,
        error: "state_changed",
      });
      expect((await snapshot(fixture)).request.status).toBe(
        "session_scheduled",
      );
    });
  });

  describe("confirm and decline racing each other", () => {
    it("leaves one consistent outcome and one event", async () => {
      const fixture = await createFixture({ withProposal: true });
      const [confirmed, declined] = await Promise.all([
        confirmLearnerMatch(db, context(fixture)),
        declineLearnerMatch(db, context(fixture)),
      ]);
      expect([confirmed.ok, declined.ok].filter(Boolean)).toHaveLength(1);

      const state = await snapshot(fixture);
      const decisionEvents = names(state.eventRows).filter((name) =>
        ["match_accepted", "match_declined"].includes(name),
      );
      expect(decisionEvents).toHaveLength(1);
      if (confirmed.ok) {
        expect(state.request.status).toBe("session_scheduled");
        expect(state.match?.status).toBe("accepted");
        expect(state.brief?.status).toBe("confirmed");
        expect(decisionEvents).toEqual(["match_accepted"]);
      } else {
        expect(state.request.status).toBe("matching");
        expect(state.match?.status).toBe("declined");
        expect(state.brief?.status).toBe("slot_proposed");
        expect(decisionEvents).toEqual(["match_declined"]);
      }
    });
  });

  describe("cancel", () => {
    it("cancels a waiting request once and records the event", async () => {
      const fixture = await createFixture();
      await expect(cancelLearnerRequest(db, context(fixture))).resolves.toEqual(
        { ok: true },
      );
      await expect(cancelLearnerRequest(db, context(fixture))).resolves.toEqual(
        { ok: false, error: "state_changed" },
      );
      const state = await snapshot(fixture);
      expect(state.request.status).toBe("cancelled");
      expect(
        names(state.eventRows).filter((n) => n === "request_cancelled"),
      ).toHaveLength(1);
    });

    it("cannot cancel a request that is already in a terminal state", async () => {
      const fixture = await createFixture({ requestStatus: "completed" });
      await expect(cancelLearnerRequest(db, context(fixture))).resolves.toEqual(
        { ok: false, error: "state_changed" },
      );
    });
  });

  describe("update", () => {
    const future = (days: number, hour: number) => {
      const value = new Date(Date.now() + days * DAY);
      return `${toKazakhstanDateInput(value)}T${String(hour).padStart(2, "0")}:00`;
    };
    const valid = () => ({
      deadline: toKazakhstanDateInput(new Date(Date.now() + 6 * DAY)),
      windows: [
        { start: future(3, 10), end: future(3, 11) },
        { start: future(4, 10), end: future(4, 11) },
      ],
    });

    it("saves deadline and windows for a waiting request and records the event", async () => {
      const fixture = await createFixture();
      await expect(
        updateLearnerRequest(db, valid(), context(fixture)),
      ).resolves.toEqual({ ok: true });
      const state = await snapshot(fixture);
      expect(state.request.preferredWindows).toHaveLength(2);
      expect(
        toKazakhstanDateTimeInput(
          new Date(state.request.preferredWindows[0].startUtc),
        ),
      ).toBe(valid().windows[0].start);
      expect(names(state.eventRows)).toContain("request_updated");
    });

    it("rejects windows in the past, reversed windows and deadlines beyond 14 days", async () => {
      const fixture = await createFixture();
      const base = valid();
      const past = { start: future(-1, 10), end: future(-1, 11) };
      const reversed = { start: future(3, 11), end: future(3, 10) };
      for (const input of [
        { ...base, windows: [past, base.windows[1]] },
        { ...base, windows: [reversed, base.windows[1]] },
        {
          ...base,
          deadline: toKazakhstanDateInput(new Date(Date.now() + 20 * DAY)),
        },
        { ...base, deadline: "2026-02-30" },
        { ...base, windows: [base.windows[0]] },
      ]) {
        await expect(
          updateLearnerRequest(db, input, context(fixture)),
        ).resolves.toEqual({ ok: false, error: "invalid_update" });
      }
      expect(names((await snapshot(fixture)).eventRows)).not.toContain(
        "request_updated",
      );
    });

    it("refuses to edit once a time is proposed or confirmed", async () => {
      for (const status of ["session_scheduled", "cancelled"] as const) {
        const fixture = await createFixture({ requestStatus: status });
        await expect(
          updateLearnerRequest(db, valid(), context(fixture)),
        ).resolves.toEqual({ ok: false, error: "state_changed" });
      }
      const matched = await createFixture({ withProposal: true });
      await expect(
        updateLearnerRequest(db, valid(), context(matched)),
      ).resolves.toEqual({ ok: false, error: "state_changed" });
    });

    it("resumes matching when the learner edits after a mentor withdrew", async () => {
      const fixture = await createFixture({
        withProposal: true,
        briefStatus: "withdrawn",
        matchStatus: "withdrawn",
      });
      await expect(
        updateLearnerRequest(db, valid(), context(fixture)),
      ).resolves.toEqual({ ok: true });
      const state = await snapshot(fixture);
      expect(state.request.status).toBe("matching");
      expect(
        state.transitions.some(
          (row) => row.reasonCode === "learner_resumed_after_mentor_withdrawal",
        ),
      ).toBe(true);
    });
  });

  it("only acts on the request it was given", async () => {
    const mine = await createFixture({ withProposal: true });
    const other = await createFixture({ withProposal: true });
    await confirmLearnerMatch(db, context(mine));
    const [otherRequest] = await db
      .select({ status: learnerRequests.status })
      .from(learnerRequests)
      .where(and(eq(learnerRequests.id, other.request.id)));
    expect(otherRequest.status).toBe("matched");
  });
});
