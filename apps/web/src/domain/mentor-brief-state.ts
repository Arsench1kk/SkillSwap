// Which top-level state the mentor brief page (M2) shows before any detail is
// rendered. Pure so the ordering can be unit tested without a database.

export type MentorBriefGateInput = {
  mentorRole: string;
  mentorStatus: string;
  requestStatus: string;
  briefStatus: string;
  matchStatus: string | null;
  /** Earlier of the brief answer-by time and the learner deadline. */
  answerBy: Date;
};

export type MentorBriefGate = "expired" | "cancelled" | "confirmed" | "open";

export function isMentorBriefConfirmed(
  input: Pick<
    MentorBriefGateInput,
    "briefStatus" | "matchStatus" | "requestStatus"
  >,
): boolean {
  return (
    input.briefStatus === "confirmed" ||
    input.matchStatus === "accepted" ||
    input.requestStatus === "session_scheduled"
  );
}

export function resolveMentorBriefGate(
  input: MentorBriefGateInput,
  now: Date,
): MentorBriefGate {
  if (input.mentorRole !== "mentor" || input.mentorStatus !== "active")
    return "expired";
  if (input.requestStatus === "cancelled") return "cancelled";
  // A confirmed session stays confirmed after the answer-by time has passed.
  if (isMentorBriefConfirmed(input)) return "confirmed";
  if (input.briefStatus === "expired" || input.answerBy <= now)
    return "expired";
  return "open";
}
