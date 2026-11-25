import { createHash } from "node:crypto";
import { lt, sql } from "drizzle-orm";
import { z } from "zod";
import type { ApplicationDatabase } from "@/db/types";
import { rateLimitCounters } from "@/db/schema";

const WINDOW_MS = 15 * 60 * 1000;
const rateLimitScopeSchema = z.enum([
  "mentor-brief-action",
  "mentor-brief-action-ip",
  "mentor-brief-page-ip",
  "mentor-join-ip",
  "session-action",
  "rating-action",
  "report-action",
  "learner-status-action",
  "learner-request-ip",
  "learner-request-account",
]);
export type RateLimitScope = z.infer<typeof rateLimitScopeSchema>;

const rateLimitInputSchema = z.object({
  scope: rateLimitScopeSchema,
  value: z
    .string()
    .min(1)
    .refine((key) => key.trim().length > 0),
  // The persisted counter is a PostgreSQL integer; never allow an overflow limit.
  maximum: z.number().int().min(1).max(2_147_483_647),
  now: z.date(),
});

/**
 * Stores only a one-way hash of the token or IP-derived key.
 * Call outside the business-action transaction so failed actions retain their
 * attempts. Invalid server configuration and DB errors throw, never allow.
 */
export async function allowRateLimitedAttempt(
  database: ApplicationDatabase,
  scope: RateLimitScope,
  value: string,
  maximum: number,
  now = new Date(),
): Promise<boolean> {
  rateLimitInputSchema.parse({ scope, value, maximum, now });
  const windowStartedAt = new Date(
    Math.floor(now.getTime() / WINDOW_MS) * WINDOW_MS,
  );
  const keyHash = createHash("sha256")
    .update(`${scope}:${value}`)
    .digest("hex");
  const [counter] = await database
    .insert(rateLimitCounters)
    .values({
      keyHash,
      windowStartedAt,
      count: 1,
      expiresAt: new Date(windowStartedAt.getTime() + WINDOW_MS),
    })
    .onConflictDoUpdate({
      target: [rateLimitCounters.keyHash, rateLimitCounters.windowStartedAt],
      set: { count: sql`${rateLimitCounters.count} + 1` },
      where: lt(rateLimitCounters.count, maximum),
    })
    .returning({ count: rateLimitCounters.count });
  return Boolean(counter);
}
