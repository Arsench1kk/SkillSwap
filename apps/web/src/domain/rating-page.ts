import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { feedback, sessions } from "@/db/schema";
import { verifyPrivateLink } from "@/domain/private-links";

export function isRatingWindowOpen(endsAt: Date | null, now = new Date()) {
  return !endsAt || now.getTime() <= endsAt.getTime() + 2 * 60 * 60 * 1000;
}

type RatingValues = {
  unblocked: number | null;
  oneLineOutcome: string | null;
  trust: number | null;
};

export function classifyRatingState(values: RatingValues, windowOpen: boolean) {
  if (
    values.unblocked !== null &&
    values.oneLineOutcome !== null &&
    values.trust !== null
  )
    return "submitted" as const;
  if (
    values.unblocked !== null ||
    values.oneLineOutcome !== null ||
    values.trust !== null
  )
    return windowOpen ? ("partial" as const) : ("partial_expired" as const);
  return windowOpen ? ("form" as const) : ("skipped" as const);
}

export async function getRatingPage(token: string) {
  const link = await verifyPrivateLink(db, token);
  if (
    link.status !== "valid" ||
    link.purpose !== "rating" ||
    link.subjectType !== "feedback"
  )
    return { state: "expired" as const };
  const [row] = await db
    .select({
      feedbackId: feedback.id,
      sessionId: feedback.sessionId,
      participantId: feedback.participantId,
      unblocked: feedback.unblocked,
      oneLineOutcome: feedback.oneLineOutcome,
      trust: feedback.trust,
      templateVersion: sessions.templateVersion,
      endsAt: sessions.endsAt,
    })
    .from(feedback)
    .innerJoin(sessions, eq(sessions.id, feedback.sessionId))
    .where(eq(feedback.id, link.subjectId))
    .limit(1);
  if (!row) return { state: "expired" as const };
  const windowOpen = isRatingWindowOpen(row.endsAt);
  const state = classifyRatingState(row, windowOpen);
  if (state === "submitted") return { state };
  return { state, ...row };
}
