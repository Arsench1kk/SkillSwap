import { randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@/db/schema";
import { participantContacts, participants, skillEvidence } from "@/db/schema";

import { revokeParticipantPrivateLinks } from "./private-links";

export type ParticipantRole =
  (typeof schema.participantRole.enumValues)[number];

type Transaction = Parameters<
  Parameters<NodePgDatabase<typeof schema>["transaction"]>[0]
>[0];
type Database = NodePgDatabase<typeof schema> | Transaction;

const rolePrefix: Record<ParticipantRole, string> = {
  learner: "L",
  mentor: "M",
  operator: "O",
};

export function generateParticipantId(role: ParticipantRole): string {
  return `${rolePrefix[role]}-${randomBytes(5).toString("hex")}`;
}

export async function createParticipant(
  database: Database,
  input: {
    role: ParticipantRole;
    consentGivenAt?: Date | null;
    campus?: string | null;
    yearOfStudy?: number | null;
  },
) {
  const participantId = generateParticipantId(input.role);
  const [created] = await database
    .insert(participants)
    .values({
      participantId,
      role: input.role,
      consentGivenAt: input.consentGivenAt ?? null,
      campus: input.campus ?? null,
      yearOfStudy: input.yearOfStudy ?? null,
    })
    .returning();
  return created;
}

export async function withdrawParticipantConsent(
  database: Database,
  participantId: string,
  withdrawnAt = new Date(),
) {
  return database.transaction(async (tx) => {
    const [updated] = await tx
      .update(participants)
      .set({
        status: "withdrawn",
        consentWithdrawnAt: sql`case when ${participants.consentGivenAt} is not null
          then coalesce(${participants.consentWithdrawnAt}, ${withdrawnAt.toISOString()}::timestamptz) end`,
      })
      .where(eq(participants.participantId, participantId))
      .returning();
    if (!updated) return null;
    if (updated.role !== "operator") {
      await tx
        .delete(participantContacts)
        .where(eq(participantContacts.participantId, participantId));
      await revokeParticipantPrivateLinks(tx, participantId, withdrawnAt);
    }
    if (updated.role === "mentor") {
      await tx
        .update(skillEvidence)
        .set({ proofReference: null })
        .where(eq(skillEvidence.mentorParticipantId, participantId));
    }
    return updated;
  });
}
