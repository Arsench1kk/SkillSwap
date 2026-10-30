import { z } from "zod";
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@/db/schema";
import { events, participants } from "@/db/schema";

const eventInputSchema = z
  .object({
    eventName: z.enum(schema.eventName.enumValues),
    experiment: z.enum(schema.experimentId.enumValues).nullable().optional(),
    briefType: z.enum(schema.briefType.enumValues).nullable().optional(),
    taskCategory: z.enum(schema.taskCategory.enumValues).nullable().optional(),
    sourceChannel: z.string().trim().min(1).max(40).nullable().optional(),
    reasonCode: z.string().trim().min(1).max(80).nullable().optional(),
    value: z.number().int().nullable().optional(),
    missingReason: z
      .enum(schema.missingReason.enumValues)
      .nullable()
      .optional(),
    correctsEventId: z.string().uuid().nullable().optional(),
    note: z.string().max(1000).nullable().optional(),
    timestampUtc: z.date().optional(),
  })
  .strict()
  .superRefine((event, ctx) => {
    if (event.eventName === "brief_sent" && !event.briefType) {
      ctx.addIssue({
        code: "custom",
        path: ["briefType"],
        message: "Required for brief_sent",
      });
    }
    if (
      ["decline_reason", "no_show", "safety_flag"].includes(event.eventName) &&
      !event.reasonCode
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["reasonCode"],
        message: "Required for this event",
      });
    }
    if (event.sourceChannel && !/^[a-zA-Z0-9_-]+$/.test(event.sourceChannel)) {
      ctx.addIssue({
        code: "custom",
        path: ["sourceChannel"],
        message: "Use a non-identifying code",
      });
    }
    if (event.note && containsContactData(event.note)) {
      ctx.addIssue({
        code: "custom",
        path: ["note"],
        message: "Notes cannot contain contact details",
      });
    }
  });

const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const handlePattern = /(?:^|\s)@[a-zA-Z0-9_]{2,}/;
const phonePattern = /(?:\+?\d[\s().-]*){9,}/;

export function containsContactData(value: string): boolean {
  return (
    emailPattern.test(value) ||
    handlePattern.test(value) ||
    phonePattern.test(value)
  );
}

export type EventInput = z.input<typeof eventInputSchema>;

export function validateEventInput(input: EventInput) {
  return eventInputSchema.parse(input);
}
export type EventContext = {
  /** This context is created by server code, never copied from a request body. */
  participantId: string;
  dataOrigin: (typeof schema.dataOrigin.enumValues)[number];
  /** Loaded from the request/brief/session by server code when applicable. */
  templateVersion?: string | null;
  /** Optional operator who caused/recorded the action; never accepted from client input. */
  actorParticipantId?: string;
};

type Transaction = Parameters<
  Parameters<NodePgDatabase<typeof schema>["transaction"]>[0]
>[0];
type EventDatabase = NodePgDatabase<typeof schema> | Transaction;

export async function recordEvent(
  database: EventDatabase,
  context: EventContext,
  untrustedInput: EventInput,
) {
  const input = validateEventInput(untrustedInput);
  const [participant] = await database
    .select({ role: participants.role })
    .from(participants)
    .where(eq(participants.participantId, context.participantId))
    .limit(1);
  if (!participant) throw new Error("Event participant not found");

  if (context.actorParticipantId) {
    const [actor] = await database
      .select({ role: participants.role })
      .from(participants)
      .where(eq(participants.participantId, context.actorParticipantId))
      .limit(1);
    if (!actor || actor.role !== "operator") {
      throw new Error("Event actor must be an operator participant");
    }
  }

  const requiresTemplate = [
    "brief_sent",
    "mentor_viewed",
    "mentor_accepted",
    "slot_proposed",
    "match_accepted",
    "decline_reason",
    "mentor_withdrew",
    "mentor_no_reply",
    "session_started",
    "session_completed",
    "no_show",
    "usefulness_submitted",
    "trust_submitted",
  ].includes(input.eventName);
  if (requiresTemplate && !context.templateVersion?.trim()) {
    throw new Error(`template_version is required for ${input.eventName}`);
  }

  const [created] = await database
    .insert(events)
    .values({
      participantId: context.participantId,
      role: participant.role,
      eventName: input.eventName,
      timestampUtc: input.timestampUtc,
      experiment: input.experiment ?? null,
      dataOrigin: context.dataOrigin,
      uiLocale: "en",
      templateVersion: context.templateVersion ?? null,
      briefType: input.briefType ?? null,
      taskCategory: input.taskCategory ?? null,
      sourceChannel: input.sourceChannel ?? null,
      reasonCode: input.reasonCode ?? null,
      value: input.value ?? null,
      missingReason: input.missingReason ?? null,
      actor: context.actorParticipantId ?? null,
      correctsEventId: input.correctsEventId ?? null,
      note: input.note ?? null,
    })
    .returning();
  return created;
}
