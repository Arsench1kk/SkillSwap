import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { Pool, type PoolClient } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { expireUnansweredFeedback } from "./expire-feedback";

const state = vi.hoisted(() => ({
  database: undefined as unknown,
  feedbackId: "",
  event: vi.fn(),
}));
vi.mock("@/db/client", () => ({
  get db() {
    return state.database;
  },
}));
vi.mock("@/domain/private-links", () => ({
  verifyPrivateLink: async () => ({
    status: "valid",
    purpose: "rating",
    subjectType: "feedback",
    subjectId: state.feedbackId,
  }),
}));
vi.mock("@/domain/rate-limit", () => ({
  allowRateLimitedAttempt: async () => true,
}));
vi.mock("@/domain/mentor-brief-page", () => ({
  currentDataOrigin: () => "rehearsal",
}));
vi.mock("@/domain/events", () => ({
  containsContactData: () => false,
  recordEvent: (...args: unknown[]) => state.event(...args),
}));
import { POST } from "../../app/api/rating/route";

const connectionString = process.env.SKILLSWAP_D4_TEST_DATABASE_URL;
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function waitForBlock(
  observer: PoolClient,
  waiter: number,
  blocker: number,
) {
  const deadline = performance.now() + 3000;
  while (performance.now() < deadline) {
    const result = await observer.query(
      "SELECT $2::int = ANY(pg_blocking_pids($1::int)) AS blocked",
      [waiter, blocker],
    );
    if (result.rows[0].blocked) return;
    await delay(10);
  }
  throw new Error("Expected PostgreSQL row-lock wait was not observed");
}
function submit() {
  return POST(
    new Request("http://localhost/api/rating", {
      method: "POST",
      body: JSON.stringify({ token: "a".repeat(43), trust: 5 }),
    }),
  );
}
afterEach(() => {
  vi.useRealTimers();
  state.event.mockReset();
});

describe.skipIf(!connectionString)(
  "D4 rating/expiry PostgreSQL concurrency",
  () => {
    it.each([
      "rating commits first",
      "rating rolls back",
      "expiry commits first",
    ])(
      "%s",
      async (order) => {
        // Shared isolated schema: temporary tables cannot be used across connections.
        const namespace = `d4_race_${randomUUID().replaceAll("-", "")}`;
        const admin = new Pool({ connectionString, max: 1 });
        const observer = await admin.connect();
        const options = `-c search_path=${namespace} -c statement_timeout=5000 -c lock_timeout=4000`;
        const appPool = new Pool({ connectionString, options, max: 1 });
        const jobPool = new Pool({ connectionString, options, max: 1 });
        let job: PoolClient | undefined;
        const releaseEvent = deferred();
        const eventEntered = deferred();
        let request: Promise<Response> | undefined;
        let expiry: Promise<number> | undefined;
        try {
          await observer.query(`CREATE SCHEMA "${namespace}"`);
          await observer.query(`SET search_path TO "${namespace}"`);
          await observer.query(`
        CREATE TYPE missing_reason AS ENUM ('incomplete','no_reply','excluded');
        CREATE TABLE sessions (id uuid PRIMARY KEY, template_version text, completion_state text, ends_at timestamptz);
        CREATE TABLE feedback (
          id uuid PRIMARY KEY, session_id uuid REFERENCES sessions, participant_id text,
          unblocked smallint, one_line_outcome text, trust smallint,
          unblocked_missing_reason missing_reason, outcome_missing_reason missing_reason, trust_missing_reason missing_reason,
          CHECK ((unblocked IS NULL) = (unblocked_missing_reason IS NOT NULL)),
          CHECK ((one_line_outcome IS NULL) = (outcome_missing_reason IS NOT NULL)),
          CHECK ((trust IS NULL) = (trust_missing_reason IS NOT NULL))
        );
        CREATE TABLE rating_test_events (event_name text, value integer);
      `);
          const sessionId = randomUUID();
          state.feedbackId = randomUUID();
          const { rows } = await observer.query(
            "INSERT INTO sessions VALUES ($1,'v1','completed',now() - interval '3 hours') RETURNING ends_at",
            [sessionId],
          );
          await observer.query(
            "INSERT INTO feedback VALUES ($1,$2,'L-test',4,NULL,NULL,NULL,'incomplete','incomplete')",
            [state.feedbackId, sessionId],
          );
          const appPid = (await appPool.query("SELECT pg_backend_pid() AS pid"))
            .rows[0].pid;
          job = await jobPool.connect();
          const jobPid = (await job.query("SELECT pg_backend_pid() AS pid"))
            .rows[0].pid;
          state.database = drizzle(appPool);
          // Freeze the admission clock before cutoff for the in-flight request;
          // the expiry connection uses a real PostgreSQL clock after cutoff.
          vi.useFakeTimers({ toFake: ["Date"] });
          vi.setSystemTime(
            new Date(
              rows[0].ends_at.getTime() +
                (order === "expiry commits first" ? 3 : 1) * 3600000,
            ),
          );
          state.event.mockImplementation(async (tx, _context, input) => {
            // Exercise actual route writes/locks/rollback, substituting only the
            // event writer so it can pause after UPDATE and fail before COMMIT.
            await tx.execute(
              sql`INSERT INTO rating_test_events VALUES (${input.eventName}, ${input.value})`,
            );
            eventEntered.resolve();
            await releaseEvent.promise;
            if (order === "rating rolls back")
              throw new Error("Injected event failure");
          });
          if (order === "expiry commits first") {
            await job.query("BEGIN");
            expect(await expireUnansweredFeedback(job as unknown as Pool)).toBe(
              1,
            );
            request = submit();
            await waitForBlock(observer, appPid, jobPid);
            await job.query("COMMIT");
            expect((await request).status).toBe(410);
            expect(state.event).not.toHaveBeenCalled();
          } else {
            request = submit();
            await Promise.race([
              eventEntered.promise,
              delay(3000).then(() => {
                throw new Error("Rating did not reach its transaction barrier");
              }),
            ]);
            expiry = expireUnansweredFeedback(job as unknown as Pool);
            await waitForBlock(observer, jobPid, appPid);
            releaseEvent.resolve();
            expect((await request).status).toBe(
              order === "rating commits first" ? 200 : 503,
            );
            expect(await expiry).toBe(1);
          }
          const row = (await observer.query("SELECT * FROM feedback")).rows[0];
          expect(row.unblocked).toBe(4);
          expect(row.unblocked_missing_reason).toBeNull();
          expect(row.one_line_outcome).toBeNull();
          expect(row.outcome_missing_reason).toBe("no_reply");
          expect(row.trust).toBe(order === "rating commits first" ? 5 : null);
          expect(row.trust_missing_reason).toBe(
            order === "rating commits first" ? null : "no_reply",
          );
          expect(
            (await observer.query("SELECT * FROM rating_test_events")).rows,
          ).toEqual(
            order === "rating commits first"
              ? [{ event_name: "trust_submitted", value: 5 }]
              : [],
          );
          expect(await expireUnansweredFeedback(job as unknown as Pool)).toBe(
            0,
          );
        } finally {
          releaseEvent.resolve();
          if (job) await job.query("ROLLBACK");
          await Promise.allSettled([request, expiry].filter(Boolean));
          job?.release();
          await appPool.end();
          await jobPool.end();
          await observer.query(`DROP SCHEMA IF EXISTS "${namespace}" CASCADE`);
          observer.release();
          await admin.end();
        }
      },
      15000,
    );
  },
);
