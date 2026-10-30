import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@/db/schema";
import { participants } from "@/db/schema";

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
  const [updated] = await database
    .update(participants)
    .set({ consentWithdrawnAt: withdrawnAt, status: "withdrawn" })
    .where(eq(participants.participantId, participantId))
    .returning();
  return updated ?? null;
}
