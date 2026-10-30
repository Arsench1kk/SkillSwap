import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  learnerRequests,
  matches,
  mentorBriefs,
  participants,
} from "@/db/schema";
import { recordEvent } from "@/domain/events";
import { verifyPrivateLink } from "@/domain/private-links";
import { transitionMentorBrief } from "@/domain/state-machines";
import { formatKazakhstanTime } from "@/domain/time";

export type MentorBriefPageData = {
  state:
    | "expired"
    | "cancelled"
    | "declined"
    | "withdrawn"
    | "unanswered"
    | "answered"
    | "confirmed";
  token: string;
  taskDescription?: string;
  triedAlready?: string;
  deadline?: string;
  answerBy?: string;
  giveBack?: string | null;
  windows?: { value: string; label: string }[];
  proposedSlot?: string | null;
  proposedSlotInput?: string | null;
  confirmedTask?: string;
};

export function currentDataOrigin():
  "real_pilot" | "constructed" | "rehearsal" {
  const configured = process.env.SKILLSWAP_DATA_ORIGIN;
  if (
    configured === "real_pilot" ||
    configured === "constructed" ||
    configured === "rehearsal"
  ) {
    return configured as "real_pilot" | "constructed" | "rehearsal";
  }
  if (process.env.NODE_ENV !== "production") return "rehearsal" as const;
  throw new Error(
    "SKILLSWAP_DATA_ORIGIN must be configured before recording events",
  );
}

function safeBriefText(value: string): string {
  const email = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
  const handle = /(?:^|\s)@[a-zA-Z0-9_]{2,}/g;
  const phone = /(?:\+?\d[\s().-]*){9,}/g;
  return value
    .replace(email, "•••")
    .replace(handle, " •••")
    .replace(phone, "•••");
}

export async function getMentorBriefPage(
  token: string,
): Promise<MentorBriefPageData> {
  const expired: MentorBriefPageData = { state: "expired", token };
  const verified = await verifyPrivateLink(db, token);
  if (
    verified.status !== "valid" ||
    verified.purpose !== "mentor_brief" ||
    verified.subjectType !== "mentor_brief"
  )
    return expired;

  const [row] = await db
    .select({
      briefId: mentorBriefs.id,
      mentorParticipantId: mentorBriefs.mentorParticipantId,
      mentorRole: participants.role,
      mentorStatus: participants.status,
      templateVersion: mentorBriefs.templateVersion,
      answerBy: mentorBriefs.answerBy,
      briefStatus: mentorBriefs.status,
      requestStatus: learnerRequests.status,
      taskDescription: learnerRequests.taskDescription,
      triedAlready: learnerRequests.triedAlready,
      deadlineAt: learnerRequests.deadlineAt,
      preferredWindows: learnerRequests.preferredWindows,
      giveBack: learnerRequests.giveBack,
      requestId: learnerRequests.id,
      matchStatus: matches.status,
      proposedSlotAt: matches.proposedSlotAt,
    })
    .from(mentorBriefs)
    .innerJoin(learnerRequests, eq(mentorBriefs.requestId, learnerRequests.id))
    .innerJoin(
      participants,
      eq(mentorBriefs.mentorParticipantId, participants.participantId),
    )
    .leftJoin(
      matches,
      and(
        eq(matches.requestId, learnerRequests.id),
        eq(matches.mentorParticipantId, mentorBriefs.mentorParticipantId),
      ),
    )
    .where(eq(mentorBriefs.id, verified.subjectId))
    .limit(1);

  if (
    !row ||
    row.briefId !== verified.subjectId ||
    row.mentorRole !== "mentor" ||
    row.mentorStatus !== "active"
  )
    return expired;
  if (row.requestStatus === "cancelled") return { state: "cancelled", token };
  if (row.briefStatus === "expired" || row.answerBy <= new Date())
    return expired;

  if (row.briefStatus === "invited") {
    const result = await transitionMentorBrief(db, row.briefId, "viewed", {
      actor: { type: "participant", participantId: row.mentorParticipantId },
      source: "mentor_brief_page",
      reasonCode: "mentor_opened_brief",
    });
    if (result.ok) {
      await recordEvent(
        db,
        {
          participantId: row.mentorParticipantId,
          dataOrigin: currentDataOrigin(),
          templateVersion: row.templateVersion,
        },
        { eventName: "mentor_viewed" },
      );
    }
  }

  if (["no_reply"].includes(row.briefStatus)) {
    return { state: "declined", token };
  }
  if (row.briefStatus === "withdrawn") return { state: "withdrawn", token };
  if (
    row.briefStatus === "confirmed" ||
    row.matchStatus === "accepted" ||
    row.requestStatus === "session_scheduled"
  )
    return {
      state: "confirmed",
      token,
      proposedSlot: row.proposedSlotAt ? formatKazakhstanTime(row.proposedSlotAt, "en") : null,
      confirmedTask: safeBriefText(row.taskDescription),
    };

  const windows = row.preferredWindows.map((window, index) => {
    const start = new Date(window.startUtc);
    return {
      value: String(index),
      label: formatKazakhstanTime(start, "en"),
    };
  });
  const isAnswered =
    row.briefStatus === "accepted" || row.briefStatus === "slot_proposed";
  const proposedSlot = row.proposedSlotAt
    ? formatKazakhstanTime(row.proposedSlotAt, "en")
    : null;
  const proposedSlotInput = row.proposedSlotAt
    ? new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Asia/Almaty",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      })
        .format(row.proposedSlotAt)
        .replace(" ", "T")
    : null;

  return {
    state: row.briefStatus === "declined" ? "declined" : isAnswered ? "answered" : "unanswered",
    token,
    taskDescription: safeBriefText(row.taskDescription),
    triedAlready: safeBriefText(row.triedAlready),
    deadline: formatKazakhstanTime(row.deadlineAt, "en"),
    answerBy: formatKazakhstanTime(row.answerBy, "en"),
    giveBack: row.giveBack ? safeBriefText(row.giveBack) : null,
    windows,
    proposedSlot,
    proposedSlotInput,
  };
}
