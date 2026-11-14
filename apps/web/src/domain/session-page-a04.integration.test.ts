import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@/db/schema";
import { describe, expect, it, vi } from "vitest";

const connection = vi.hoisted(() => ({ database: undefined as unknown }));
vi.mock("@/db/client", () => ({
  get db() {
    return connection.database;
  },
}));
import { getSessionPage } from "./session-page";
import { createPrivateLink } from "./private-links";

const connectionString = process.env.SKILLSWAP_D4_TEST_DATABASE_URL;

// Characterization of the known defect, NOT an acceptance test for its fix.
// Do not preserve these assertions after adopting the approved R07 token model.
describe.skipIf(!connectionString)(
  "A04 participant-only session link reproduction",
  () => {
    it.each([
      ["learner", false],
      ["learner", true],
      ["mentor", false],
      ["mentor", true],
    ] as const)(
      "reproduces ambiguous links for %s (reverse insertion: %s)",
      async (role, reverse) => {
        const namespace = `d4_a04_${randomUUID().replaceAll("-", "")}`;
        const pool = new Pool({ connectionString, max: 1 });
        const client = await pool.connect();
        try {
          await client.query(`CREATE SCHEMA "${namespace}"`);
          await client.query(`SET search_path TO "${namespace}"`);
          await client.query(`
        CREATE TABLE participants (participant_id text PRIMARY KEY, role text, status text);
        CREATE TABLE learner_requests (id uuid PRIMARY KEY, participant_id text, task_description text);
        CREATE TABLE matches (id uuid PRIMARY KEY, request_id uuid, mentor_participant_id text, status text);
        CREATE TABLE sessions (id uuid PRIMARY KEY, match_id uuid UNIQUE, template_version text, starts_at timestamptz, meet_url text, completion_state text);
        CREATE TABLE link_tokens (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), token_hash bytea UNIQUE, purpose text,
          subject_type text, subject_id text, expires_at timestamptz, revoked_at timestamptz, created_at timestamptz DEFAULT now());
      `);
          const database = drizzle(client, { schema });
          connection.database = database;
          const participantId =
            role === "learner" ? "L-0123456789" : "M-0123456789";
          await client.query(
            "INSERT INTO participants VALUES ($1,$2,'active')",
            [participantId, role],
          );
          const fixtures = [
            {
              id: randomUUID(),
              task: "Repair a chart",
              meet: "https://meet.google.com/aaa-bbbb-ccc",
            },
            {
              id: randomUUID(),
              task: "Debug a function",
              meet: "https://meet.google.com/ddd-eeee-fff",
            },
          ];
          if (reverse) fixtures.reverse();
          async function insertSession(fixture: (typeof fixtures)[number]) {
            const requestId = randomUUID();
            const matchId = randomUUID();
            await client.query(
              "INSERT INTO learner_requests VALUES ($1,$2,$3)",
              [
                requestId,
                role === "learner" ? participantId : "L-abcdef0123",
                fixture.task,
              ],
            );
            await client.query(
              "INSERT INTO matches VALUES ($1,$2,$3,'accepted')",
              [
                matchId,
                requestId,
                role === "mentor" ? participantId : "M-abcdef0123",
              ],
            );
            await client.query(
              "INSERT INTO sessions VALUES ($1,$2,'v1',now(),$3,'scheduled')",
              [fixture.id, matchId, fixture.meet],
            );
          }
          const issueLink = () =>
            createPrivateLink(database, {
              purpose: "session",
              subjectType: "participant",
              subjectId: participantId,
              expiresAt: new Date(Date.now() + 3600000),
            });
          await insertSession(fixtures[0]);
          const first = await issueLink();
          // Control: one meeting works with the existing link model.
          expect(await getSessionPage(first.token)).toMatchObject({
            state: "ready",
            sessionId: fixtures[0].id,
            task: fixtures[0].task,
            meetUrl: fixtures[0].meet,
          });
          await insertSession(fixtures[1]);
          const second = await issueLink();
          expect(second.token).not.toBe(first.token);
          const pageA = await getSessionPage(first.token);
          const pageB = await getSessionPage(second.token);
          expect(pageA.state).toBe("ready");
          expect(pageB.state).toBe("ready");
          // Both valid tokens have the same subject and cannot select two meetings.
          // Do not assume which row PostgreSQL chooses: ORDER BY is not the fix.
          expect(pageA.sessionId).toBe(pageB.sessionId);
          const selected = fixtures.find(
            (fixture) => fixture.id === pageA.sessionId,
          );
          expect(selected).toBeDefined();
          expect(pageA.task).toBe(selected!.task);
          expect(pageA.meetUrl).toBe(selected!.meet);
          expect(pageB.task).toBe(pageA.task);
          expect(pageB.meetUrl).toBe(pageA.meetUrl);
          await client.query(
            "UPDATE link_tokens SET revoked_at=now() WHERE id=$1",
            [first.id],
          );
          expect((await getSessionPage(first.token)).state).toBe("expired");
        } finally {
          await client.query(`DROP SCHEMA IF EXISTS "${namespace}" CASCADE`);
          client.release();
          await pool.end();
        }
      },
    );

    it.todo(
      "R07/D1: approved recipient + session binding selects the intended meeting for both roles, read/start/cancel/rating, with an explicit legacy policy",
    );
  },
);
