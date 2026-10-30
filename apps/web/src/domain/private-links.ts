import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@/db/schema";
import { linkTokens } from "@/db/schema";

type Transaction = Parameters<
  Parameters<NodePgDatabase<typeof schema>["transaction"]>[0]
>[0];
type Database = NodePgDatabase<typeof schema> | Transaction;
type Purpose = (typeof schema.tokenPurpose.enumValues)[number];
type SubjectType = (typeof schema.tokenSubjectType.enumValues)[number];

export type LinkVerification =
  | {
      status: "valid";
      linkId: string;
      purpose: Purpose;
      subjectType: SubjectType;
      subjectId: string;
    }
  | { status: "expired" | "revoked" | "not_found" };

function hashToken(rawToken: string): Buffer {
  return createHash("sha256").update(rawToken, "utf8").digest();
}

export async function createPrivateLink(
  database: Database,
  input: {
    purpose: Purpose;
    subjectType: SubjectType;
    subjectId: string;
    expiresAt: Date;
  },
): Promise<{ id: string; token: string }> {
  if (input.expiresAt.getTime() <= Date.now()) {
    throw new Error("Private link expiry must be in the future");
  }
  const token = randomBytes(32).toString("base64url");
  const [row] = await database
    .insert(linkTokens)
    .values({
      tokenHash: hashToken(token),
      purpose: input.purpose,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      expiresAt: input.expiresAt,
    })
    .returning({ id: linkTokens.id });
  // Return the raw secret once to the caller; never log or persist it.
  return { id: row.id, token };
}

export async function verifyPrivateLink(
  database: Database,
  rawToken: string,
  now = new Date(),
): Promise<LinkVerification> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(rawToken)) return { status: "not_found" };
  const [row] = await database
    .select()
    .from(linkTokens)
    .where(eq(linkTokens.tokenHash, hashToken(rawToken)))
    .limit(1);
  if (!row) return { status: "not_found" };
  if (row.revokedAt) return { status: "revoked" };
  if (row.expiresAt.getTime() <= now.getTime()) return { status: "expired" };
  return {
    status: "valid",
    linkId: row.id,
    purpose: row.purpose,
    subjectType: row.subjectType,
    subjectId: row.subjectId,
  };
}

export async function revokePrivateLink(
  database: Database,
  linkId: string,
  revokedAt = new Date(),
): Promise<boolean> {
  const [row] = await database
    .update(linkTokens)
    .set({ revokedAt })
    .where(eq(linkTokens.id, linkId))
    .returning({ id: linkTokens.id });
  return Boolean(row);
}
