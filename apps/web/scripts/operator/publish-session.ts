import { and, asc, eq, gt, inArray, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { db, pool } from "../../src/db/client";
import { matches, sessions } from "../../src/db/schema";
import { requireActiveOperator } from "../../src/domain/operator-access";
import { formatKazakhstanTime } from "../../src/domain/time";
import { publishSession } from "../../src/services/sessions/publish-session";

import { baseUrlSchema } from "./private-link-base";

async function listMeetings(operatorId: string) {
  const rows = await db.transaction(async (tx) => {
    await requireActiveOperator(tx, operatorId);
    return tx
      .select({ id: sessions.id, startsAt: sessions.startsAt })
      .from(sessions)
      .innerJoin(matches, eq(matches.id, sessions.matchId))
      .where(
        and(
          eq(matches.status, "accepted"),
          eq(matches.humanDecision, "accepted"),
          isNotNull(matches.learnerAcceptedAt),
          isNotNull(matches.mentorAcceptedAt),
          inArray(sessions.completionState, ["scheduled", "started"]),
          gt(sessions.startsAt, new Date(Date.now() - 24 * 60 * 60 * 1000)),
        ),
      )
      .orderBy(asc(sessions.startsAt), asc(sessions.id));
  });

  if (!rows.length) console.log("No meetings available to publish.");
  for (const { id, startsAt } of rows) {
    if (startsAt) console.log(id, formatKazakhstanTime(startsAt, "en"));
  }
}

async function main() {
  const [operatorId, sessionId, meetUrl, ...extra] = process.argv.slice(2);
  if (
    process.env.DATABASE_URL &&
    operatorId &&
    sessionId === "--list" &&
    !meetUrl
  ) {
    await listMeetings(operatorId);
    return;
  }
  const base = baseUrlSchema.safeParse(process.env.NEXT_PUBLIC_APP_URL);
  if (
    !process.env.DATABASE_URL ||
    !base.success ||
    !operatorId ||
    !sessionId ||
    !meetUrl ||
    extra.length
  ) {
    throw new Error(
      "Usage: set DATABASE_URL and NEXT_PUBLIC_APP_URL, then run npx tsx scripts/operator/publish-session.ts <operator ID> --list or <operator ID> <session UUID> <Google Meet URL>",
    );
  }
  if (!process.stdout.isTTY) {
    throw new Error("Run from a private terminal to copy the links directly.");
  }
  const links = await publishSession(db, { operatorId, sessionId, meetUrl });
  console.log(
    "Learner:",
    new URL(`/session/${links.learner.token}`, base.data).href,
  );
  console.log(
    "Mentor:",
    new URL(`/session/${links.mentor.token}`, base.data).href,
  );
  console.log("Expires at:", formatKazakhstanTime(links.expiresAt, "en"));
}

main()
  .catch((error: unknown) => {
    console.error(
      error instanceof z.ZodError
        ? "Check the operator ID, meeting ID and Google Meet URL."
        : error instanceof Error &&
            /^(Usage:|Run from|Active operator required|Meeting unavailable|Private link expiry)/.test(
              error.message,
            )
          ? error.message
          : "Could not publish the meeting.",
    );
    process.exitCode = 1;
  })
  .finally(() => pool.end());
