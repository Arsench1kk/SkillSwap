import { createHash, randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseExecutor } from "@/db/types";
import * as schema from "@/db/schema";
import { linkTokens } from "@/db/schema";

type Purpose = (typeof schema.tokenPurpose.enumValues)[number];
type SubjectType = (typeof schema.tokenSubjectType.enumValues)[number];

const createLinkSchema = z
  .object({
    purpose: z.enum(schema.tokenPurpose.enumValues),
    subjectType: z.enum(schema.tokenSubjectType.enumValues),
    subjectId: z.string().min(1),
    expiresAt: z.date(),
  })
  .strict()
  .superRefine((input, context) => {
    const validSubject =
      input.subjectType === "participant"
        ? /^[LMO]-[0-9a-f]{10}$/.test(input.subjectId)
        : z.uuid().safeParse(input.subjectId).success;
    if (!validSubject) {
      context.addIssue({
        code: "custom",
        path: ["subjectId"],
        message: "Invalid private link subject ID",
      });
    }
  });

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
  database: DatabaseExecutor,
  serverInput: {
    purpose: Purpose;
    subjectType: SubjectType;
    subjectId: string;
    expiresAt: Date;
  },
): Promise<{ id: string; token: string }> {
  const input = createLinkSchema.parse(serverInput);
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
  database: DatabaseExecutor,
  rawToken: string,
  now = new Date(),
): Promise<LinkVerification> {
  if (typeof rawToken !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(rawToken))
    return { status: "not_found" };
  z.date().parse(now);
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
  database: DatabaseExecutor,
  linkId: string,
  revokedAt = new Date(),
): Promise<boolean> {
  z.uuid().parse(linkId);
  z.date().parse(revokedAt);
  const [row] = await database
    .update(linkTokens)
    // Preserve the first recorded revocation, including concurrent retries.
    .set({ revokedAt: sql`coalesce(${linkTokens.revokedAt}, ${revokedAt})` })
    .where(eq(linkTokens.id, linkId))
    .returning({ id: linkTokens.id });
  return Boolean(row);
}
