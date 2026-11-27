import { and, asc, eq, inArray, lte, or } from "drizzle-orm";
import {
  learnerRequests,
  matches,
  mentorBriefs,
  participants,
} from "@/db/schema";
import type { DatabaseTransaction } from "@/db/types";
import { revokeMentorBriefLinks } from "@/domain/private-links";
import { transitionMentorBrief } from "@/domain/state-machines";

export async function expireUnansweredInvitations(
  tx: DatabaseTransaction,
  now: Date,
) {
  const candidates = await tx
    .select({ id: mentorBriefs.id, requestId: mentorBriefs.requestId })
    .from(mentorBriefs)
    .innerJoin(learnerRequests, eq(learnerRequests.id, mentorBriefs.requestId))
    .where(
      and(
        inArray(learnerRequests.status, ["eligible", "matching"]),
        inArray(mentorBriefs.status, ["invited", "viewed"]),
        or(
          lte(mentorBriefs.answerBy, now),
          lte(learnerRequests.deadlineAt, now),
        ),
      ),
    )
    .orderBy(asc(mentorBriefs.answerBy), asc(mentorBriefs.id))
    .limit(50)
    .for("update", { of: mentorBriefs, skipLocked: true });
  for (const candidate of candidates) {
    const [brief] = await tx
      .select({
        mentorId: mentorBriefs.mentorParticipantId,
        status: mentorBriefs.status,
        answerBy: mentorBriefs.answerBy,
      })
      .from(mentorBriefs)
      .where(eq(mentorBriefs.id, candidate.id));
    const [request] = await tx
      .select({
        status: learnerRequests.status,
        learnerId: learnerRequests.participantId,
        deadlineAt: learnerRequests.deadlineAt,
      })
      .from(learnerRequests)
      .where(eq(learnerRequests.id, candidate.requestId))
      .for("update");
    if (
      !brief ||
      !request ||
      !["eligible", "matching"].includes(request.status) ||
      !["invited", "viewed"].includes(brief.status) ||
      (brief.answerBy > now && request.deadlineAt > now)
    )
      continue;
    const candidateMatches = await tx
      .select({
        id: matches.id,
        status: matches.status,
        mentorAcceptedAt: matches.mentorAcceptedAt,
        learnerAcceptedAt: matches.learnerAcceptedAt,
      })
      .from(matches)
      .where(
        and(
          eq(matches.requestId, candidate.requestId),
          eq(matches.mentorParticipantId, brief.mentorId),
        ),
      )
      .for("update")
      .limit(2);
    const [match] = candidateMatches;
    if (
      candidateMatches.length !== 1 ||
      match.status !== "proposed" ||
      match.mentorAcceptedAt ||
      match.learnerAcceptedAt
    )
      continue;

    const active = await tx
      .select({ id: participants.participantId })
      .from(participants)
      .where(
        and(
          inArray(participants.participantId, [
            request.learnerId,
            brief.mentorId,
          ]),
          eq(participants.status, "active"),
        ),
      )
      .for("share");
    if (active.length !== 2) continue;

    const outcome = await transitionMentorBrief(
      tx,
      candidate.id,
      "no_reply",
      {
        actor: { type: "system" },
        source: "operator_cli",
        reasonCode: "no_reply",
        at: now,
      },
      {
        input: {
          eventName: "mentor_no_reply",
          missingReason: "no_reply",
        },
      },
    );
    if (!outcome.ok) continue;
    await tx
      .update(matches)
      .set({ status: "expired" })
      .where(eq(matches.id, match.id));
    await revokeMentorBriefLinks(tx, [candidate.id], now);
  }
}
