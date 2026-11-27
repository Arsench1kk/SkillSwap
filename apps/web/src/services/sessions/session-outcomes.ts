import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { matches, participants, sessions } from "@/db/schema";
import type { DatabaseExecutor, DatabaseTransaction } from "@/db/types";
import { currentDataOrigin } from "@/domain/event-context";
import { recordEvent } from "@/domain/events";
import {
  operatorIdSchema,
  requireActiveOperator,
} from "@/domain/operator-access";
import { verifyPrivateLink } from "@/domain/private-links";
import { canCancelSession, resolveSessionLink } from "@/domain/session-page";
import {
  transitionLearnerRequest,
  type TransitionContext,
} from "@/domain/state-machines";
import { isOpenSession, lockSession } from "./lock-session";

type LockedSession = NonNullable<Awaited<ReturnType<typeof lockSession>>>;

async function closeUnheldSession(
  tx: DatabaseTransaction,
  { request, match, session }: LockedSession,
  outcome: "cancelled" | "no_show",
  transitionContext: TransitionContext,
) {
  const result = await transitionLearnerRequest(
    tx,
    request.id,
    outcome,
    transitionContext,
  );
  if (!result.ok) throw new Error("Meeting unavailable");
  await tx
    .update(matches)
    .set({ status: "withdrawn" })
    .where(eq(matches.id, match.id));
  await tx
    .update(sessions)
    .set({ completionState: outcome, meetUrl: null })
    .where(eq(sessions.id, session.id));
}

export function actOnSessionLink(
  database: DatabaseExecutor,
  token: string,
  action: "start" | "cancel",
) {
  return database.transaction(async (tx) => {
    const access = await resolveSessionLink(
      await verifyPrivateLink(tx, token),
      tx,
    );
    if (!access) return "unavailable" as const;
    const meeting = await lockSession(tx, access.session.id);
    if (!meeting) return "unavailable" as const;

    // A withdrawal takes this participant lock before revoking links.
    const [active] = await tx
      .select({ id: participants.participantId })
      .from(participants)
      .where(
        and(
          eq(participants.participantId, access.participant.id),
          eq(participants.status, "active"),
        ),
      )
      .for("share");
    if (!active) return "unavailable" as const;
    const refreshed = await resolveSessionLink(
      await verifyPrivateLink(tx, token),
      tx,
    );
    if (refreshed?.session.id !== meeting.session.id)
      return "unavailable" as const;

    const { request, session } = meeting;
    if (
      action === "cancel" &&
      session.completionState === "cancelled" &&
      request.status === "cancelled"
    )
      return "ok" as const;
    if (!isOpenSession(meeting)) return "state_changed" as const;

    let eventName: "session_started" | "session_cancelled";
    if (action === "cancel") {
      if (!canCancelSession(session)) return "state_changed" as const;
      await closeUnheldSession(tx, meeting, "cancelled", {
        actor: { type: "system" },
        source: "L4",
        reasonCode: "session_cancelled",
      });
      eventName = "session_cancelled";
    } else {
      if (session.completionState === "started") return "ok" as const;
      await tx
        .update(sessions)
        .set({ completionState: "started" })
        .where(eq(sessions.id, session.id));
      eventName = "session_started";
    }
    await recordEvent(
      tx,
      {
        participantId: active.id,
        dataOrigin: currentDataOrigin(),
        templateVersion: session.templateVersion,
      },
      { eventName },
    );
    return "ok" as const;
  });
}

const noShowInput = z
  .object({
    operatorId: operatorIdSchema,
    sessionId: z.uuid(),
    absent: z.enum(["learner", "mentor", "both"]),
  })
  .strict();

const SESSION_DURATION_MS = 45 * 60_000;

export function recordSessionNoShow(
  database: DatabaseExecutor,
  input: z.input<typeof noShowInput>,
) {
  const { operatorId, sessionId, absent } = noShowInput.parse(input);
  return database.transaction(async (tx) => {
    const actorId = await requireActiveOperator(tx, operatorId);
    const meeting = await lockSession(tx, sessionId);
    if (meeting?.session.completionState === "no_show")
      throw new Error("Meeting already marked as a no-show");
    if (!meeting || !isOpenSession(meeting))
      throw new Error("Meeting unavailable");
    const { request, session } = meeting;
    const now = new Date();
    if (
      !session.startsAt ||
      session.startsAt.getTime() + SESSION_DURATION_MS > now.getTime()
    )
      throw new Error("Wait until the scheduled meeting ends");

    const reasonCode = `${absent}_absent`;
    await closeUnheldSession(tx, meeting, "no_show", {
      actor: { type: "operator", participantId: actorId },
      source: "operator_cli",
      reasonCode,
      at: now,
    });
    await recordEvent(
      tx,
      {
        participantId: request.learner,
        actorParticipantId: actorId,
        dataOrigin: currentDataOrigin(),
        templateVersion: session.templateVersion,
      },
      { eventName: "no_show", reasonCode, timestampUtc: now },
    );
  });
}
