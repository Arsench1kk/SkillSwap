import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  learnerRequests,
  matches,
  mentorBriefs,
  mentorProfiles,
  participants,
  participantContacts,
  sessions,
  skillEvidence,
} from "@/db/schema";
import {
  formatKazakhstanTime,
  toKazakhstanDateInput,
  toKazakhstanDateTimeInput,
} from "@/domain/time";
import { verifyPrivateLink } from "@/domain/private-links";

export type LearnerStatusPageData = {
  state:
    | "expired"
    | "waiting"
    | "no_match"
    | "matched"
    | "time_declined"
    | "mentor_withdrew"
    | "session_cancelled"
    | "confirmed"
    | "cancelled"
    | "ineligible";
  token: string;
  task?: string;
  deadline?: string;
  deadlineInput?: string;
  windows?: string[];
  windowInputs?: { start: string; end: string }[];
  proposedTime?: string;
  mentor?: {
    displayName: string | null;
    year: number | null;
    skill: string | null;
    proofType: string | null;
    experience: string | null;
  };
  contacts?: { type: string; value: string }[];
  reportHref?: string;
};

export function learnerRecoveryState(
  requestStatus: string,
  matchStatus: string | undefined,
  humanDecision: string | undefined,
  sessionCompletionState?: string | null,
): "time_declined" | "mentor_withdrew" | "session_cancelled" | null {
  if (
    requestStatus === "session_scheduled" &&
    sessionCompletionState === "cancelled"
  )
    return "session_cancelled";
  if (requestStatus === "matching" && humanDecision === "rejected")
    return "time_declined";
  if (matchStatus === "withdrawn") return "mentor_withdrew";
  return null;
}

export const NO_MATCH_AFTER_MS = 24 * 60 * 60 * 1000;

type StatusMatch = {
  status: string;
  humanDecision: string;
  mentorAcceptedAt: Date | null;
  learnerAcceptedAt: Date | null;
  proposedSlotAt: Date | null;
  sessionCompletionState?: string | null;
};

/**
 * Maps the database state of a request (learner_request_status enum) and its
 * newest match to the screen state of L2/L3. Request, match and brief
 * statuses are different things: only `requestStatus` is the request status.
 * Terminal request states (cancelled, ineligible, expired) are handled by the
 * caller before this runs.
 */
export function deriveLearnerStatusState(input: {
  requestStatus: string;
  requestCreatedAt: Date;
  match?: StatusMatch;
  now: Date;
}): {
  state: LearnerStatusPageData["state"];
  isConfirmed: boolean;
  isReadyToConfirm: boolean;
} {
  const { requestStatus, match, now } = input;
  const isConfirmed =
    match?.status === "accepted" &&
    match.learnerAcceptedAt !== null &&
    match.mentorAcceptedAt !== null;
  const isReadyToConfirm =
    requestStatus === "matched" &&
    match?.humanDecision === "accepted" &&
    match.status === "proposed" &&
    match.mentorAcceptedAt !== null &&
    match.proposedSlotAt !== null;

  const recovery = learnerRecoveryState(
    requestStatus,
    match?.status,
    match?.humanDecision,
    match?.sessionCompletionState,
  );
  if (recovery) return { state: recovery, isConfirmed, isReadyToConfirm };
  if (isConfirmed) return { state: "confirmed", isConfirmed, isReadyToConfirm };
  if (isReadyToConfirm)
    return { state: "matched", isConfirmed, isReadyToConfirm };
  const waitedTooLong =
    now.getTime() - input.requestCreatedAt.getTime() >= NO_MATCH_AFTER_MS &&
    ["eligible", "matching"].includes(requestStatus);
  return {
    state:
      requestStatus === "no_match" || waitedTooLong ? "no_match" : "waiting",
    isConfirmed,
    isReadyToConfirm,
  };
}

export async function getLearnerStatusPage(
  token: string,
): Promise<LearnerStatusPageData> {
  const expired: LearnerStatusPageData = { state: "expired", token };
  const verified = await verifyPrivateLink(db, token);
  if (
    verified.status !== "valid" ||
    verified.purpose !== "learner_status" ||
    verified.subjectType !== "learner_request"
  )
    return expired;

  const [request] = await db
    .select()
    .from(learnerRequests)
    .where(eq(learnerRequests.id, verified.subjectId))
    .limit(1);
  if (!request) return expired;

  if (request.status === "cancelled") return { state: "cancelled", token };
  if (request.status === "ineligible") return { state: "ineligible", token };
  if (request.status === "expired") return expired;

  const [match] = await db
    .select({
      id: matches.id,
      requestId: matches.requestId,
      recommendedMentorId: matches.recommendedMentorId,
      recommendationReason: matches.recommendationReason,
      mentorParticipantId: matches.mentorParticipantId,
      humanDecision: matches.humanDecision,
      humanDecisionReason: matches.humanDecisionReason,
      proposedSlotAt: matches.proposedSlotAt,
      mentorAcceptedAt: matches.mentorAcceptedAt,
      learnerAcceptedAt: matches.learnerAcceptedAt,
      status: matches.status,
      createdAt: matches.createdAt,
      sessionCompletionState: sessions.completionState,
    })
    .from(matches)
    .leftJoin(sessions, eq(sessions.matchId, matches.id))
    .where(eq(matches.requestId, request.id))
    .orderBy(desc(matches.createdAt))
    .limit(1);

  const { state, isConfirmed, isReadyToConfirm } = deriveLearnerStatusState({
    requestStatus: request.status,
    requestCreatedAt: request.createdAt,
    match: match
      ? {
          status: match.status,
          humanDecision: match.humanDecision,
          mentorAcceptedAt: match.mentorAcceptedAt,
          learnerAcceptedAt: match.learnerAcceptedAt,
          proposedSlotAt: match.proposedSlotAt,
          sessionCompletionState: match.sessionCompletionState,
        }
      : undefined,
    now: new Date(),
  });

  const base: LearnerStatusPageData = {
    state,
    token,
    task: request.taskDescription,
    deadline: formatKazakhstanTime(request.deadlineAt, "en"),
    deadlineInput: toKazakhstanDateInput(request.deadlineAt),
    windows: request.preferredWindows.map((window) =>
      formatKazakhstanTime(new Date(window.startUtc), "en"),
    ),
    windowInputs: request.preferredWindows.map((window) => ({
      start: toKazakhstanDateTimeInput(new Date(window.startUtc)),
      end: toKazakhstanDateTimeInput(new Date(window.endUtc)),
    })),
    proposedTime: match?.proposedSlotAt
      ? formatKazakhstanTime(match.proposedSlotAt, "en")
      : undefined,
  };

  if (!match?.mentorParticipantId || (!isReadyToConfirm && !isConfirmed)) {
    return base;
  }

  const [mentor] = await db
    .select({
      displayName: mentorProfiles.displayName,
      year: participants.yearOfStudy,
      experience: mentorProfiles.experienceStatement,
    })
    .from(participants)
    .innerJoin(
      mentorProfiles,
      eq(mentorProfiles.participantId, participants.participantId),
    )
    .where(eq(participants.participantId, match.mentorParticipantId))
    .limit(1);
  const [proof] = await db
    .select({
      category: skillEvidence.category,
      topic: skillEvidence.topic,
      proofType: skillEvidence.proofType,
    })
    .from(skillEvidence)
    .where(
      and(
        eq(skillEvidence.mentorParticipantId, match.mentorParticipantId),
        eq(skillEvidence.verificationState, "verified"),
      ),
    )
    .limit(1);

  const data = {
    ...base,
    mentor: mentor
      ? {
          displayName: mentor.displayName,
          year: mentor.year,
          skill: proof ? `${proof.category} · ${proof.topic}` : null,
          proofType: proof?.proofType ?? null,
          experience: mentor.experience,
        }
      : undefined,
  };

  if (!isConfirmed) return data;

  const [mentorContact, learnerContact] = await Promise.all([
    db
      .select({
        type: participantContacts.contactType,
        value: participantContacts.value,
      })
      .from(participantContacts)
      .where(eq(participantContacts.participantId, match.mentorParticipantId))
      .limit(1),
    db
      .select({
        type: participantContacts.contactType,
        value: participantContacts.value,
      })
      .from(participantContacts)
      .where(eq(participantContacts.participantId, request.participantId))
      .limit(1),
  ]);
  return { ...data, contacts: [...mentorContact, ...learnerContact] };
}

export async function getReadyLearnerMatch(token: string) {
  const verified = await verifyPrivateLink(db, token);
  if (
    verified.status !== "valid" ||
    verified.purpose !== "learner_status" ||
    verified.subjectType !== "learner_request"
  )
    return null;
  const [match] = await db
    .select({
      id: matches.id,
      requestId: learnerRequests.id,
      learnerParticipantId: learnerRequests.participantId,
      requestStatus: learnerRequests.status,
      matchStatus: matches.status,
      humanDecision: matches.humanDecision,
      mentorParticipantId: matches.mentorParticipantId,
      mentorAcceptedAt: matches.mentorAcceptedAt,
      proposedSlotAt: matches.proposedSlotAt,
    })
    .from(matches)
    .innerJoin(learnerRequests, eq(learnerRequests.id, matches.requestId))
    .where(eq(matches.requestId, verified.subjectId))
    .orderBy(desc(matches.createdAt))
    .limit(1);
  if (
    !match ||
    match.requestStatus !== "matched" ||
    match.matchStatus !== "proposed" ||
    match.humanDecision !== "accepted" ||
    !match.mentorParticipantId ||
    !match.mentorAcceptedAt
  )
    return null;
  const [brief] = await db
    .select({
      id: mentorBriefs.id,
      templateVersion: mentorBriefs.templateVersion,
      status: mentorBriefs.status,
    })
    .from(mentorBriefs)
    .where(
      and(
        eq(mentorBriefs.requestId, match.requestId),
        eq(mentorBriefs.mentorParticipantId, match.mentorParticipantId),
      ),
    )
    .orderBy(desc(mentorBriefs.sentAt))
    .limit(1);
  if (!brief || brief.status !== "slot_proposed") return null;
  return {
    ...match,
    briefId: brief.id,
    templateVersion: brief.templateVersion,
  };
}
