import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { db, pool } from "@/db/client";
import { events, learnerRequests } from "@/db/schema";
import { createParticipant } from "./participants";
import { recordEvent } from "./events";

// Fixtures, including append-only events, are removed by transaction rollback.
const rollback = new Error("synthetic_privacy_fixture_rollback");
async function withRollback(
  run: (
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  ) => Promise<void>,
) {
  try {
    await db.transaction(async (tx) => {
      await run(tx);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
}

describe.skipIf(!process.env.DATABASE_URL)(
  "event privacy with PostgreSQL",
  () => {
    afterAll(async () => {
      await pool.end();
    });

    it.each([
      { reasonCode: "synthetic@example.test" },
      { sourceChannel: "77771234567" },
      { note: "Use https://t.me/synthetic_handle" },
    ])(
      "rejects private metadata without appending an event (%#)",
      async (metadata) => {
        await withRollback(async (tx) => {
          const learner = await createParticipant(tx, { role: "learner" });
          await expect(
            recordEvent(
              tx,
              { participantId: learner.participantId, dataOrigin: "rehearsal" },
              { eventName: "request_submitted", ...metadata },
            ),
          ).rejects.toThrow();
          expect(
            await tx
              .select()
              .from(events)
              .where(eq(events.participantId, learner.participantId)),
          ).toHaveLength(0);
        });
      },
    );

    it("preserves approved codes, anonymous role and explicit missing values", async () => {
      await withRollback(async (tx) => {
        const learner = await createParticipant(tx, { role: "learner" });
        const created = await recordEvent(
          tx,
          { participantId: learner.participantId, dataOrigin: "rehearsal" },
          {
            eventName: "eligibility_checked",
            reasonCode: "deadline_outside_14_days",
            sourceChannel: "web",
            value: null,
            missingReason: "excluded",
          },
        );
        expect(created).toMatchObject({
          participantId: learner.participantId,
          role: "learner",
          dataOrigin: "rehearsal",
          reasonCode: "deadline_outside_14_days",
          sourceChannel: "web",
          value: null,
          missingReason: "excluded",
        });
      });
    });

    it("rolls back the domain write if recording its event rejects contact data", async () => {
      await withRollback(async (tx) => {
        const learner = await createParticipant(tx, { role: "learner" });
        await expect(
          tx.transaction(async (action) => {
            await action.insert(learnerRequests).values({
              participantId: learner.participantId,
              taskCategory: "STEM",
              taskDescription: "SYNTHETIC PRIVACY TEST",
              triedAlready: "SYNTHETIC ATTEMPT",
              deadlineAt: new Date(Date.now() + 86_400_000),
              preferredWindows: [],
              status: "submitted",
            });
            await recordEvent(
              action,
              { participantId: learner.participantId, dataOrigin: "rehearsal" },
              {
                eventName: "request_submitted",
                reasonCode: "(@synthetic_handle)",
              },
            );
          }),
        ).rejects.toThrow();
        expect(
          await tx
            .select()
            .from(learnerRequests)
            .where(eq(learnerRequests.participantId, learner.participantId)),
        ).toHaveLength(0);
        expect(
          await tx
            .select()
            .from(events)
            .where(eq(events.participantId, learner.participantId)),
        ).toHaveLength(0);
      });
    });
  },
);
