import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import {
  learnerRequests,
  matches,
  mentorBriefs,
  participants,
} from "@/db/schema";
import type { DatabaseTransaction } from "@/db/types";
import { containsContactData, recordEvent } from "@/domain/events";
import { currentDataOrigin } from "@/domain/mentor-brief-page";
import { verifyPrivateLink } from "@/domain/private-links";
import {
  transitionLearnerRequest,
  transitionMentorBrief,
} from "@/domain/state-machines";
import { allowRateLimitedAttempt } from "@/domain/rate-limit";
import { kazakhstanLocalTimeToUtc } from "@/domain/time";
import { t } from "@/messages/en";

const payloadSchema = z
  .object({
    token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    action: z.enum(["propose", "decline", "withdraw"]),
    windowIndex: z.union([z.string(), z.null()]).optional(),
    suggestedAt: z.union([z.string(), z.null()]).optional(),
    reasonCode: z.union([z.string(), z.null()]).optional(),
    note: z.union([z.string().max(280), z.null()]).optional(),
  })
  .strict();

const declineReasonCodes = [
  "not_my_skill",
  "no_time_before_deadline",
  "task_unclear",
  "unfamiliar_person",
  "other",
] as const;

function unavailable(status = 409) {
  return Response.json({ message: t("briefActionUnavailable") }, { status });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return unavailable(400);
  }
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) return unavailable(400);
  const input = parsed.data;

  try {
    const forwardedFor = request.headers
      .get("x-forwarded-for")
      ?.split(",")[0]
      ?.trim();
    const clientIp =
      forwardedFor || request.headers.get("x-real-ip") || "unknown";
    if (
      !(await allowRateLimitedAttempt(
        db,
        "mentor-brief-action-ip",
        clientIp,
        30,
      ))
    ) {
      return Response.json({ message: t("briefRateLimited") }, { status: 429 });
    }
    if (
      !(await allowRateLimitedAttempt(
        db,
        "mentor-brief-action",
        input.token,
        10,
      ))
    ) {
      return Response.json({ message: t("briefRateLimited") }, { status: 429 });
    }
    const link = await verifyPrivateLink(db, input.token);
    if (
      link.status !== "valid" ||
      link.purpose !== "mentor_brief" ||
      link.subjectType !== "mentor_brief"
    )
      return unavailable(410);

    const [brief] = await db
      .select({
        id: mentorBriefs.id,
        requestId: mentorBriefs.requestId,
        mentorParticipantId: mentorBriefs.mentorParticipantId,
        templateVersion: mentorBriefs.templateVersion,
        answerBy: mentorBriefs.answerBy,
        status: mentorBriefs.status,
        requestStatus: learnerRequests.status,
        deadlineAt: learnerRequests.deadlineAt,
        mentorRole: participants.role,
        mentorStatus: participants.status,
      })
      .from(mentorBriefs)
      .innerJoin(
        learnerRequests,
        eq(mentorBriefs.requestId, learnerRequests.id),
      )
      .innerJoin(
        participants,
        eq(mentorBriefs.mentorParticipantId, participants.participantId),
      )
      .where(eq(mentorBriefs.id, link.subjectId))
      .limit(1);
    if (
      !brief ||
      brief.id !== link.subjectId ||
      brief.mentorRole !== "mentor" ||
      brief.mentorStatus !== "active"
    )
      return unavailable(410);
    const now = new Date();
    if (
      brief.requestStatus === "cancelled" ||
      brief.answerBy <= now ||
      brief.deadlineAt <= now ||
      ["confirmed", "completed", "no_reply", "expired", "withdrawn"].includes(
        brief.status,
      )
    )
      return unavailable(409);

    const [match] = await db
      .select({
        id: matches.id,
        mentorAcceptedAt: matches.mentorAcceptedAt,
        status: matches.status,
      })
      .from(matches)
      .where(
        and(
          eq(matches.requestId, brief.requestId),
          eq(matches.mentorParticipantId, brief.mentorParticipantId),
        ),
      )
      .limit(1);
    if (!match) return unavailable(409);
    if (
      match.status === "accepted" ||
      brief.requestStatus === "session_scheduled"
    )
      return unavailable(409);

    const eventContext = {
      participantId: brief.mentorParticipantId,
      dataOrigin: currentDataOrigin(),
      templateVersion: brief.templateVersion,
    };

    async function lockResponse(tx: DatabaseTransaction) {
      const [currentBrief] = await tx
        .select({
          status: mentorBriefs.status,
          answerBy: mentorBriefs.answerBy,
        })
        .from(mentorBriefs)
        .where(eq(mentorBriefs.id, brief.id))
        .for("update");
      const [currentRequest] = await tx
        .select({
          status: learnerRequests.status,
          deadlineAt: learnerRequests.deadlineAt,
          windows: learnerRequests.preferredWindows,
        })
        .from(learnerRequests)
        .where(eq(learnerRequests.id, brief.requestId))
        .for("update");
      const [currentMatch] = await tx
        .select({
          humanDecision: matches.humanDecision,
          status: matches.status,
          mentorAcceptedAt: matches.mentorAcceptedAt,
        })
        .from(matches)
        .where(eq(matches.id, match.id))
        .for("update");
      const [mentor] = await tx
        .select({ id: participants.participantId })
        .from(participants)
        .where(
          and(
            eq(participants.participantId, brief.mentorParticipantId),
            eq(participants.role, "mentor"),
            eq(participants.status, "active"),
          ),
        )
        .for("share");
      const at = new Date();
      const verified = await verifyPrivateLink(tx, input.token, at);
      if (
        !mentor ||
        verified.status !== "valid" ||
        !currentBrief ||
        currentBrief.answerBy <= at ||
        !currentRequest ||
        currentRequest.deadlineAt <= at ||
        !["matching", "matched"].includes(currentRequest.status) ||
        !currentMatch ||
        !["proposed", "declined"].includes(currentMatch.status)
      )
        throw new Error("state_conflict");
      return { currentBrief, currentRequest, currentMatch, at };
    }

    if (input.action === "decline") {
      if (brief.status === "declined") return unavailable(409);
      const reasonCode = declineReasonCodes.find(
        (reason) => reason === input.reasonCode,
      );
      if (!reasonCode) {
        return unavailable(400);
      }
      const note = input.note?.trim() || null;
      if (note && containsContactData(note)) return unavailable(400);
      await db.transaction(async (tx) => {
        await lockResponse(tx);
        const result = await transitionMentorBrief(tx, brief.id, "declined", {
          actor: {
            type: "participant",
            participantId: brief.mentorParticipantId,
          },
          source: "mentor_brief_page",
          reasonCode: "mentor_declined",
        });
        if (!result.ok) throw new Error("state_conflict");
        await tx
          .update(matches)
          .set({ status: "declined" })
          .where(eq(matches.id, match.id));
        await recordEvent(tx, eventContext, {
          eventName: "decline_reason",
          reasonCode,
          note,
        });
      });
      return Response.json({ ok: true });
    }

    if (brief.status === "slot_proposed" && input.action === "withdraw") {
      // This is a new append-only event; the earlier proposal remains in the log.
      await db.transaction(async (tx) => {
        const { currentBrief } = await lockResponse(tx);
        if (currentBrief.status !== "slot_proposed")
          throw new Error("state_conflict");
        const result = await transitionMentorBrief(tx, brief.id, "withdrawn", {
          actor: {
            type: "participant",
            participantId: brief.mentorParticipantId,
          },
          source: "mentor_brief_page",
          reasonCode: "mentor_withdrew_before_confirmation",
        });
        if (!result.ok) throw new Error("state_conflict");
        await tx
          .update(matches)
          .set({ status: "withdrawn" })
          .where(eq(matches.id, match.id));
        await recordEvent(tx, eventContext, { eventName: "mentor_withdrew" });
      });
      return Response.json({ ok: true });
    }
    if (input.action === "withdraw") return unavailable(409);

    const result = await db.transaction(async (tx) => {
      const { currentBrief, currentRequest, currentMatch, at } =
        await lockResponse(tx);

      let proposedAt: Date | null = null;
      if (input.windowIndex === "other" && input.suggestedAt) {
        proposedAt = kazakhstanLocalTimeToUtc(input.suggestedAt);
      } else if (input.windowIndex && /^\d+$/.test(input.windowIndex)) {
        const window = currentRequest.windows[Number(input.windowIndex)];
        if (window) proposedAt = new Date(window.startUtc);
      }
      if (
        !proposedAt ||
        Number.isNaN(proposedAt.getTime()) ||
        proposedAt <= at ||
        proposedAt > currentRequest.deadlineAt
      )
        return "invalid_time" as const;
      if (currentBrief.status === "invited") {
        const viewed = await transitionMentorBrief(tx, brief.id, "viewed", {
          actor: {
            type: "participant",
            participantId: brief.mentorParticipantId,
          },
          source: "mentor_brief_page",
          reasonCode: "mentor_opened_brief",
        });
        if (!viewed.ok) throw new Error("state_conflict");
      }
      if (
        currentBrief.status === "invited" ||
        currentBrief.status === "viewed"
      ) {
        const accepted = await transitionMentorBrief(tx, brief.id, "accepted", {
          actor: {
            type: "participant",
            participantId: brief.mentorParticipantId,
          },
          source: "mentor_brief_page",
          reasonCode: "mentor_accepted_brief",
        });
        if (!accepted.ok) throw new Error("state_conflict");
      }
      if (["invited", "viewed", "accepted"].includes(currentBrief.status)) {
        const proposed = await transitionMentorBrief(
          tx,
          brief.id,
          "slot_proposed",
          {
            actor: {
              type: "participant",
              participantId: brief.mentorParticipantId,
            },
            source: "mentor_brief_page",
            reasonCode: "mentor_proposed_time",
          },
        );
        if (!proposed.ok) throw new Error("state_conflict");
      } else if (currentBrief.status === "declined") {
        const proposed = await transitionMentorBrief(
          tx,
          brief.id,
          "slot_proposed",
          {
            actor: {
              type: "participant",
              participantId: brief.mentorParticipantId,
            },
            source: "mentor_brief_page",
            reasonCode: "mentor_changed_decline_to_proposal",
          },
        );
        if (!proposed.ok) throw new Error("state_conflict");
      } else if (currentBrief.status !== "slot_proposed") {
        throw new Error("state_conflict");
      }

      if (currentRequest.status === "matching") {
        if (currentMatch.humanDecision !== "accepted")
          throw new Error("state_conflict");
        const matched = await transitionLearnerRequest(
          tx,
          brief.requestId,
          "matched",
          {
            actor: { type: "system" },
            source: "mentor_brief_page",
            reasonCode: "mentor_proposed_time",
            at,
          },
        );
        if (!matched.ok) throw new Error("state_conflict");
      }

      await tx
        .update(matches)
        .set({
          proposedSlotAt: proposedAt,
          mentorAcceptedAt: currentMatch.mentorAcceptedAt ?? at,
          status: "proposed",
        })
        .where(eq(matches.id, match.id));
      await recordEvent(tx, eventContext, {
        eventName: "mentor_accepted",
        timestampUtc: at,
      });
      await recordEvent(tx, eventContext, {
        eventName: "slot_proposed",
        timestampUtc: at,
      });
    });
    if (result === "invalid_time") return unavailable(400);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "state_conflict")
      return unavailable(409);
    return unavailable(500);
  }
}
