import { z } from "zod";
import { eq } from "drizzle-orm";
import type { DatabaseExecutor } from "@/db/types";
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
    for (const field of ["note", "reasonCode", "sourceChannel"] as const) {
      const value = event[field];
      if (value && containsContactData(value)) {
        ctx.addIssue({
          code: "custom",
          path: [field],
          message: "Event metadata cannot contain contact details",
        });
      }
    }
  });

const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const handlePattern = /(?:^|[^a-zA-Z0-9_])@[a-zA-Z0-9_]{2,}/;
const phonePattern = /(?:\+?\d[\s().-]*){9,}/;
const contactLinkPattern = /\b(?:t\.me|telegram\.me|wa\.me)\//i;

export function containsContactData(value: string): boolean {
  return (
    emailPattern.test(value) ||
    handlePattern.test(value) ||
    phonePattern.test(value) ||
    contactLinkPattern.test(value)
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

const eventContextSchema = z
  .object({
    participantId: z.string().regex(/^[LMO]-[0-9a-f]{10}$/),
    dataOrigin: z.enum(schema.dataOrigin.enumValues),
    templateVersion: z
      .string()
      .refine((value) => value.trim().length > 0)
      .nullable()
      .optional(),
    actorParticipantId: z
      .string()
      .regex(/^O-[0-9a-f]{10}$/)
      .optional(),
  })
  .strict();

export function validateEventContext(context: EventContext) {
  return eventContextSchema.parse(context);
}

export async function recordEvent(
  database: DatabaseExecutor,
  serverContext: EventContext,
  untrustedInput: EventInput,
) {
  const input = validateEventInput(untrustedInput);
  const context = validateEventContext(serverContext);
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
