import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { learnerRequests, matches, mentorBriefs } from "@/db/schema";
import { recordEvent } from "@/domain/events";
import { verifyPrivateLink } from "@/domain/private-links";
import {
  transitionLearnerRequest,
  transitionMentorBrief,
} from "@/domain/state-machines";
import { kazakhstanLocalTimeToUtc, toKazakhstanDateInput } from "@/domain/time";
import { allowRateLimitedAttempt } from "@/domain/rate-limit";

const actionSchema = z
  .object({
    token: z.string().min(1).max(128),
    action: z.enum(["cancel", "confirm", "decline", "update"]),
    deadline: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    windows: z
      .array(
        z.object({ start: z.string().min(1), end: z.string().min(1) }).strict(),
      )
      .min(2)
      .max(3)
      .optional(),
  })
  .strict();

function validDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function addCalendarDays(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

const dataOrigin = z
  .enum(["real_pilot", "constructed", "rehearsal"])
  .catch("rehearsal")
  .parse(process.env.SKILLSWAP_DATA_ORIGIN);

export async function POST(request: Request) {
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  try {
    if (
      !(await allowRateLimitedAttempt(
        db,
        "learner-status-action",
        parsed.data.token,
        10,
      ))
    ) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }
    const verified = await verifyPrivateLink(db, parsed.data.token);
    if (
      verified.status !== "valid" ||
      verified.purpose !== "learner_status" ||
      verified.subjectType !== "learner_request"
    ) {
      return NextResponse.json({ error: "link_unavailable" }, { status: 410 });
    }
    const [requestRow] = await db
      .select()
      .from(learnerRequests)
      .where(eq(learnerRequests.id, verified.subjectId))
      .limit(1);
    if (!requestRow)
      return NextResponse.json({ error: "link_unavailable" }, { status: 410 });

    const now = new Date();
    if (parsed.data.action === "update") {
      if (
        !parsed.data.deadline ||
        !validDate(parsed.data.deadline) ||
        !parsed.data.windows
      ) {
        return NextResponse.json({ error: "state_changed" }, { status: 409 });
      }
      const deadlineAt = kazakhstanLocalTimeToUtc(
        `${parsed.data.deadline}T23:59`,
      );
      const today = toKazakhstanDateInput(now);
      const windows = parsed.data.windows.map(({ start, end }) => {
        const startUtc = kazakhstanLocalTimeToUtc(start);
        const endUtc = kazakhstanLocalTimeToUtc(end);
        return startUtc && endUtc && startUtc > now && endUtc > startUtc
          ? { startUtc, endUtc }
          : null;
      });
      if (
        !deadlineAt ||
        deadlineAt < now ||
        parsed.data.deadline < today ||
        parsed.data.deadline > addCalendarDays(today, 14) ||
        windows.some((window) => !window)
      ) {
        return NextResponse.json({ error: "invalid_update" }, { status: 400 });
      }
      const updated = await db.transaction(async (tx) => {
        const [currentRequest] = await tx
          .select({ status: learnerRequests.status })
          .from(learnerRequests)
          .where(eq(learnerRequests.id, requestRow.id))
          .for("update")
          .limit(1);
        if (!currentRequest) return false;
        let resumingAfterWithdrawal = false;
        if (currentRequest.status === "matched") {
          const [latestMatch] = await tx
            .select({ status: matches.status })
            .from(matches)
            .where(eq(matches.requestId, requestRow.id))
            .orderBy(desc(matches.createdAt))
            .for("update")
            .limit(1);
          resumingAfterWithdrawal = latestMatch?.status === "withdrawn";
        } else if (!["eligible", "matching"].includes(currentRequest.status)) {
          return false;
        }
        if (currentRequest.status === "matched" && !resumingAfterWithdrawal)
          return false;
        if (resumingAfterWithdrawal) {
          const transition = await transitionLearnerRequest(
            tx,
            requestRow.id,
            "matching",
            {
              actor: {
                type: "participant",
                participantId: requestRow.participantId,
              },
              source: "L2",
              reasonCode: "learner_resumed_after_mentor_withdrawal",
              at: now,
            },
          );
          if (!transition.ok) return false;
        }
        await tx
          .update(learnerRequests)
          .set({
            deadlineAt,
            preferredWindows: windows.map((window) => ({
              startUtc: window!.startUtc.toISOString(),
              endUtc: window!.endUtc.toISOString(),
            })),
            updatedAt: now,
          })
          .where(eq(learnerRequests.id, requestRow.id));
        await recordEvent(
          tx,
          { participantId: requestRow.participantId, dataOrigin },
          {
            eventName: "request_updated",
            taskCategory: requestRow.taskCategory,
          },
        );
        return true;
      });
      if (!updated)
        return NextResponse.json({ error: "state_changed" }, { status: 409 });
      return NextResponse.json({ ok: true });
    }
    if (parsed.data.action === "cancel") {
      const cancelled = await db.transaction(async (tx) => {
        const transition = await transitionLearnerRequest(
          tx,
          requestRow.id,
          "cancelled",
          {
            actor: {
              type: "participant",
              participantId: requestRow.participantId,
            },
            source: "L2",
            reasonCode: "learner_cancelled",
            at: now,
          },
        );
        if (!transition.ok) return false;
        await recordEvent(
          tx,
          { participantId: requestRow.participantId, dataOrigin },
          { eventName: "request_cancelled" },
        );
        return true;
      });
      if (!cancelled)
        return NextResponse.json({ error: "state_changed" }, { status: 409 });
      return NextResponse.json({ ok: true });
    }

    const [match] = await db
      .select()
      .from(matches)
      .where(eq(matches.requestId, requestRow.id))
      .orderBy(desc(matches.createdAt))
      .limit(1);
    if (
      !match ||
      match.status !== "proposed" ||
      match.humanDecision !== "accepted" ||
      !match.mentorParticipantId ||
      !match.mentorAcceptedAt
    ) {
      return NextResponse.json({ error: "state_changed" }, { status: 409 });
    }
    const [brief] = await db
      .select()
      .from(mentorBriefs)
      .where(
        and(
          eq(mentorBriefs.requestId, requestRow.id),
          eq(mentorBriefs.mentorParticipantId, match.mentorParticipantId),
        ),
      )
      .orderBy(desc(mentorBriefs.sentAt))
      .limit(1);
    if (!brief)
      return NextResponse.json({ error: "state_changed" }, { status: 409 });

    if (parsed.data.action === "decline") {
      const declined = await db.transaction(async (tx) => {
        const transition = await transitionLearnerRequest(
          tx,
          requestRow.id,
          "matching",
          {
            actor: {
              type: "participant",
              participantId: requestRow.participantId,
            },
            source: "L3",
            reasonCode: "learner_declined_time",
            at: now,
          },
        );
        if (!transition.ok) return false;
        await tx
          .update(matches)
          .set({ status: "declined", humanDecision: "rejected" })
          .where(eq(matches.id, match.id));
        await recordEvent(
          tx,
          {
            participantId: requestRow.participantId,
            dataOrigin,
            templateVersion: brief.templateVersion,
          },
          { eventName: "match_declined" },
        );
        return true;
      });
      if (!declined)
        return NextResponse.json({ error: "state_changed" }, { status: 409 });
      return NextResponse.json({ ok: true });
    }

    const confirmed = await db.transaction(async (tx) => {
      const briefTransition = await transitionMentorBrief(
        tx,
        brief.id,
        "confirmed",
        {
          actor: {
            type: "participant",
            participantId: requestRow.participantId,
          },
          source: "L3",
          reasonCode: "learner_confirmed_time",
          at: now,
        },
      );
      if (!briefTransition.ok) return false;
      const requestTransition = await transitionLearnerRequest(
        tx,
        requestRow.id,
        "session_scheduled",
        {
          actor: {
            type: "participant",
            participantId: requestRow.participantId,
          },
          source: "L3",
          reasonCode: "learner_confirmed_time",
          at: now,
        },
      );
      if (!requestTransition.ok) throw new Error("state_conflict");
      await tx
        .update(matches)
        .set({ status: "accepted", learnerAcceptedAt: now })
        .where(eq(matches.id, match.id));
      await recordEvent(
        tx,
        {
          participantId: requestRow.participantId,
          dataOrigin,
          templateVersion: brief.templateVersion,
        },
        { eventName: "match_accepted" },
      );
      return true;
    });
    if (!confirmed)
      return NextResponse.json({ error: "state_changed" }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      const details = error as {
        name?: unknown;
        code?: unknown;
        constraint?: unknown;
      };
      console.error("[request-status] action failed", {
        name: details?.name,
        code: details?.code,
        constraint: details?.constraint,
      });
    }
    if (error instanceof Error && error.message === "state_conflict")
      return NextResponse.json({ error: "state_changed" }, { status: 409 });
    return NextResponse.json({ error: "action_unavailable" }, { status: 503 });
  }
}
