import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { accountActiveRole, authUsers } from "@/db/auth-schema";
import { accountParticipants, participants } from "@/db/schema";
import type { DatabaseExecutor } from "@/db/types";
import { createParticipant } from "./participants";

export const accountRoleSchema = z.enum(accountActiveRole.enumValues);
export type AccountRole = z.infer<typeof accountRoleSchema>;

const identitySchema = z
  .object({
    authUserId: z.string().min(1),
    role: accountRoleSchema,
  })
  .strict();
const consentedIdentitySchema = identitySchema.extend({
  consentGivenAt: z.date(),
});

export type AccountParticipantInput = z.infer<typeof identitySchema>;
export type AccountParticipantIdentity = Readonly<{
  participantId: string;
  role: AccountRole;
}>;

export type AccountAccessCode =
  | "unauthorized"
  | "active_role_required"
  | "invalid_account_role"
  | "account_not_found"
  | "participant_withdrawn"
  | "participant_link_unavailable";

export class AccountAccessError extends Error {
  constructor(public readonly code: AccountAccessCode) {
    super(code);
    this.name = "AccountAccessError";
  }
}

async function readLinkedParticipant(
  database: DatabaseExecutor,
  input: AccountParticipantInput,
  lock: boolean,
): Promise<AccountParticipantIdentity | null> {
  const query = database
    .select({
      participantId: participants.participantId,
      role: accountParticipants.role,
      status: participants.status,
      consentWithdrawnAt: participants.consentWithdrawnAt,
    })
    .from(accountParticipants)
    .innerJoin(
      participants,
      eq(participants.participantId, accountParticipants.participantId),
    )
    .where(
      and(
        eq(accountParticipants.authUserId, input.authUserId),
        eq(accountParticipants.role, input.role),
      ),
    )
    .limit(1);
  const [linked] = lock ? await query.for("update") : await query;
  if (!linked) return null;
  if (linked.status !== "active" || linked.consentWithdrawnAt !== null) {
    throw new AccountAccessError("participant_withdrawn");
  }
  return { participantId: linked.participantId, role: linked.role };
}

/** Read-only: identity must come from a verified server session, never JSON. */
export async function findAccountParticipant(
  database: DatabaseExecutor,
  identity: AccountParticipantInput,
): Promise<AccountParticipantIdentity | null> {
  return readLinkedParticipant(database, identitySchema.parse(identity), false);
}

/**
 * Call only after authenticating the account and accepting participant consent.
 * Supports a caller transaction, so the mapping rolls back with the action/event.
 * This does not create mentor profiles, collect contacts, or grant operator access.
 */
export async function ensureAccountParticipant(
  database: DatabaseExecutor,
  identity: z.infer<typeof consentedIdentitySchema>,
): Promise<AccountParticipantIdentity> {
  const input = consentedIdentitySchema.parse(identity);
  return database.transaction(async (tx) => {
    // Serialize creation for an account, including concurrent first-role requests.
    // Lock order: auth user -> mapping/participant -> caller's domain records.
    const [account] = await tx
      .select({ id: authUsers.id })
      .from(authUsers)
      .where(eq(authUsers.id, input.authUserId))
      .for("no key update")
      .limit(1);
    if (!account) throw new AccountAccessError("account_not_found");

    const existing = await readLinkedParticipant(tx, input, true);
    if (existing) return existing;

    const participant = await createParticipant(tx, {
      role: input.role,
      consentGivenAt: input.consentGivenAt,
    });
    const [created] = await tx
      .insert(accountParticipants)
      .values({
        authUserId: input.authUserId,
        role: input.role,
        participantId: participant.participantId,
      })
      .onConflictDoNothing({
        target: [accountParticipants.authUserId, accountParticipants.role],
      })
      .returning({ participantId: accountParticipants.participantId });

    if (created)
      return { participantId: created.participantId, role: input.role };

    // Compatibility with existing callers that use the unique index without
    // first locking the auth user: remove the losing provisional participant.
    await tx
      .delete(participants)
      .where(eq(participants.participantId, participant.participantId));
    const winner = await readLinkedParticipant(tx, input, true);
    if (!winner) throw new AccountAccessError("participant_link_unavailable");
    return winner;
  });
}
