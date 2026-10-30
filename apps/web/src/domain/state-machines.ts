import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@/db/schema";
import {
  learnerRequests,
  mentorBriefs,
  participants,
  stateTransitions,
} from "@/db/schema";

type RequestState = (typeof schema.learnerRequestStatus.enumValues)[number];
type BriefState = (typeof schema.mentorBriefStatus.enumValues)[number];

const requestTransitions: Record<RequestState, readonly RequestState[]> = {
  draft: ["submitted", "cancelled", "expired"],
  submitted: ["eligible", "ineligible", "cancelled", "expired"],
  eligible: ["matching", "ineligible", "cancelled", "expired"],
  matching: ["matched", "no_match", "cancelled", "expired"],
  matched: ["session_scheduled", "matching", "cancelled", "expired"],
  session_scheduled: ["completed", "no_show", "cancelled", "matching"],
  completed: [],
  ineligible: [],
  expired: [],
  cancelled: [],
  no_match: ["cancelled"],
  no_show: [],
};

const briefTransitions: Record<BriefState, readonly BriefState[]> = {
  invited: ["viewed", "declined", "no_reply", "expired", "withdrawn"],
  viewed: ["accepted", "declined", "no_reply", "expired", "withdrawn"],
  accepted: ["slot_proposed", "declined", "expired", "withdrawn"],
  slot_proposed: ["confirmed", "declined", "expired", "withdrawn"],
  confirmed: ["completed"],
  completed: [],
  declined: ["slot_proposed"],
  no_reply: [],
  expired: [],
  withdrawn: [],
};

export type TransitionResult<S extends string> =
  | { ok: true; from: S; to: S }
  | { ok: false; from: S; to: S; error: "illegal_transition" };

export function transitionRequestState(
  from: RequestState,
  to: RequestState,
): TransitionResult<RequestState> {
  return requestTransitions[from].includes(to)
    ? { ok: true, from, to }
    : { ok: false, from, to, error: "illegal_transition" };
}

export function transitionBriefState(
  from: BriefState,
  to: BriefState,
): TransitionResult<BriefState> {
  return briefTransitions[from].includes(to)
    ? { ok: true, from, to }
    : { ok: false, from, to, error: "illegal_transition" };
}

export type TransitionActor =
  | { type: "system" }
  | { type: "participant" | "operator"; participantId: string };

export type TransitionContext = {
  actor: TransitionActor;
  source: string;
  reasonCode: string;
  at?: Date;
};

type Transaction = Parameters<
  Parameters<NodePgDatabase<typeof schema>["transaction"]>[0]
>[0];
type Database = NodePgDatabase<typeof schema> | Transaction;

function validateTransitionContext(context: TransitionContext): void {
  if (!context.source.trim() || !context.reasonCode.trim()) {
    throw new Error("Transition source and reason code are required");
  }
}

async function validateActor(
  tx: Parameters<Parameters<Database["transaction"]>[0]>[0],
  actor: TransitionActor,
) {
  if (actor.type === "system") return null;
  const [participant] = await tx
    .select({ role: participants.role })
    .from(participants)
    .where(eq(participants.participantId, actor.participantId))
    .limit(1);
  if (!participant) throw new Error("Transition actor not found");
  if (actor.type === "operator" && participant.role !== "operator") {
    throw new Error("Only an operator may perform this transition");
  }
  if (actor.type === "participant" && participant.role === "operator") {
    throw new Error("Operator actors must use actor type operator");
  }
  return { participantId: actor.participantId, role: participant.role };
}

function assertRequestActorCanTransition(
  actor: TransitionActor,
  actorRole: (typeof schema.participantRole.enumValues)[number] | null,
  from: RequestState,
  to: RequestState,
) {
  if (actor.type === "operator") return;
  if (actor.type === "system") {
    if (
      ["completed", "no_show", "expired"].includes(to) ||
      (from === "submitted" && ["eligible", "ineligible"].includes(to))
    )
      return;
    throw new Error(
      "System actor is not allowed to perform this request transition",
    );
  }
  if (actorRole !== "learner")
    throw new Error("Only the learner may act on a request");
  const allowed =
    (from === "draft" && to === "submitted") ||
    to === "cancelled" ||
    (from === "matched" && ["session_scheduled", "matching"].includes(to));
  if (!allowed)
    throw new Error(
      "Learner is not allowed to perform this request transition",
    );
}

function assertBriefActorCanTransition(
  actor: TransitionActor,
  actorRole: (typeof schema.participantRole.enumValues)[number] | null,
  actorIsMentor: boolean,
  actorIsLearner: boolean,
  from: BriefState,
  to: BriefState,
) {
  if (actor.type === "operator") return;
  if (actor.type === "system") {
    if (to === "no_reply" || to === "expired") return;
    throw new Error(
      "System actor is not allowed to perform this brief transition",
    );
  }
  if (actorIsMentor && actorRole === "mentor") {
    const mentorActions =
      (from === "invited" && to === "viewed") ||
      (from === "viewed" && to === "accepted") ||
      (from === "accepted" && to === "slot_proposed") ||
      (from === "declined" && to === "slot_proposed") ||
      (from === "slot_proposed" && to === "withdrawn") ||
      ["declined", "withdrawn"].includes(to);
    if (mentorActions) return;
  }
  if (actorIsLearner && actorRole === "learner" && to === "confirmed") return;
  throw new Error(
    "Participant is not allowed to perform this brief transition",
  );
}

export async function transitionLearnerRequest(
  database: Database,
  requestId: string,
  to: RequestState,
  context: TransitionContext,
): Promise<TransitionResult<RequestState>> {
  validateTransitionContext(context);
  return database.transaction(async (tx) => {
    const [request] = await tx
      .select({
        status: learnerRequests.status,
        participantId: learnerRequests.participantId,
      })
      .from(learnerRequests)
      .where(eq(learnerRequests.id, requestId))
      .for("update")
      .limit(1);
    if (!request) throw new Error("Learner request not found");
    const result = transitionRequestState(request.status, to);
    if (!result.ok) return result;
    if (
      context.actor.type === "participant" &&
      context.actor.participantId !== request.participantId
    ) {
      throw new Error("Participant may transition only their own request");
    }
    const actorDetails = await validateActor(tx, context.actor);
    assertRequestActorCanTransition(
      context.actor,
      actorDetails?.role ?? null,
      request.status,
      to,
    );
    const actorParticipantId = actorDetails?.participantId ?? null;
    const at = context.at ?? new Date();
    await tx
      .update(learnerRequests)
      .set({ status: to, updatedAt: at })
      .where(eq(learnerRequests.id, requestId));
    await tx.insert(stateTransitions).values({
      subjectType: "learner_request",
      subjectId: requestId,
      fromState: request.status,
      toState: to,
      actorType: context.actor.type,
      actorParticipantId,
      transitionedAt: at,
      source: context.source,
      reasonCode: context.reasonCode,
    });
    return result;
  });
}

export async function transitionMentorBrief(
  database: Database,
  briefId: string,
  to: BriefState,
  context: TransitionContext,
): Promise<TransitionResult<BriefState>> {
  validateTransitionContext(context);
  return database.transaction(async (tx) => {
    const [brief] = await tx
      .select({
        status: mentorBriefs.status,
        mentorParticipantId: mentorBriefs.mentorParticipantId,
        requestId: mentorBriefs.requestId,
      })
      .from(mentorBriefs)
      .where(eq(mentorBriefs.id, briefId))
      .for("update")
      .limit(1);
    if (!brief) throw new Error("Mentor brief not found");
    const result = transitionBriefState(brief.status, to);
    if (!result.ok) return result;
    let actorIsMentor = false;
    let actorIsLearner = false;
    if (context.actor.type === "participant") {
      const [request] = await tx
        .select({ participantId: learnerRequests.participantId })
        .from(learnerRequests)
        .where(eq(learnerRequests.id, brief.requestId))
        .limit(1);
      if (
        context.actor.participantId !== brief.mentorParticipantId &&
        context.actor.participantId !== request?.participantId
      ) {
        throw new Error("Participant is not part of this mentor brief");
      }
      actorIsMentor = context.actor.participantId === brief.mentorParticipantId;
      actorIsLearner = context.actor.participantId === request?.participantId;
    }
    const actorDetails = await validateActor(tx, context.actor);
    assertBriefActorCanTransition(
      context.actor,
      actorDetails?.role ?? null,
      actorIsMentor,
      actorIsLearner,
      brief.status,
      to,
    );
    const actorParticipantId = actorDetails?.participantId ?? null;
    const at = context.at ?? new Date();
    await tx
      .update(mentorBriefs)
      .set({ status: to })
      .where(eq(mentorBriefs.id, briefId));
    await tx.insert(stateTransitions).values({
      subjectType: "mentor_brief",
      subjectId: briefId,
      fromState: brief.status,
      toState: to,
      actorType: context.actor.type,
      actorParticipantId,
      transitionedAt: at,
      source: context.source,
      reasonCode: context.reasonCode,
    });
    return result;
  });
}
