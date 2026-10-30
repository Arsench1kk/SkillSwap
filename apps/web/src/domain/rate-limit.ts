import { createHash } from "node:crypto";
import { lt, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@/db/schema";
import { rateLimitCounters } from "@/db/schema";

type Database = NodePgDatabase<typeof schema>;
const WINDOW_MS = 15 * 60 * 1000;

/** Stores only a one-way hash of the token or IP-derived key. */
export async function allowRateLimitedAttempt(
  database: Database,
  scope:
    | "mentor-brief-action"
    | "mentor-brief-action-ip"
    | "mentor-brief-page-ip"
    | "mentor-join-ip"
    | "session-action"
    | "rating-action"
    | "report-action"
    | "learner-status-action"
    | "learner-request-ip"
    | "learner-request-account",
  value: string,
  maximum: number,
  now = new Date(),
): Promise<boolean> {
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
