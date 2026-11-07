import { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { expireUnansweredFeedback } from "./expire-feedback";

// Explicit opt-in only. All fixtures use connection-local temporary tables.
const connectionString = process.env.SKILLSWAP_D4_TEST_DATABASE_URL;

describe.skipIf(!connectionString)("D4 feedback expiry SQL", () => {
  it("preserves answers/reasons, respects the cutoff and reports only new work", async () => {
    const pool = new Pool({ connectionString, max: 1 });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`
        CREATE TYPE pg_temp.missing_reason AS ENUM
          ('no_reply', 'declined', 'no_skill_match', 'incomplete', 'excluded');
        CREATE TEMP TABLE sessions (
          id integer PRIMARY KEY, completion_state text, ends_at timestamptz
        );
        CREATE TEMP TABLE feedback (
          id integer PRIMARY KEY, session_id integer,
          unblocked integer, one_line_outcome text, trust integer,
          unblocked_missing_reason pg_temp.missing_reason,
          outcome_missing_reason pg_temp.missing_reason,
          trust_missing_reason pg_temp.missing_reason
        );
        INSERT INTO sessions VALUES
          (1, 'completed', now() - interval '3 hours'),
          (2, 'completed', now() - interval '2 hours'),
          (3, 'started', now() - interval '3 hours'),
          (4, 'completed', NULL),
          (5, 'cancelled', now() - interval '3 hours'),
          (6, 'scheduled', now() - interval '3 hours'),
          (7, 'no_show', now() - interval '3 hours');
        INSERT INTO feedback VALUES
          (1, 1, 4, NULL, NULL, NULL, 'incomplete', 'excluded'),
          (2, 1, NULL, NULL, NULL, 'declined', 'no_skill_match', 'no_reply'),
          (3, 1, 5, 'Solved it', 4, NULL, NULL, NULL),
          (4, 2, NULL, NULL, NULL, 'incomplete', 'incomplete', 'incomplete'),
          (5, 3, NULL, NULL, NULL, 'incomplete', 'incomplete', 'incomplete'),
          (6, 4, NULL, NULL, NULL, 'incomplete', 'incomplete', 'incomplete'),
          (7, 5, NULL, NULL, NULL, 'incomplete', 'incomplete', 'incomplete'),
          (8, 6, NULL, NULL, NULL, 'incomplete', 'incomplete', 'incomplete'),
          (9, 7, NULL, NULL, NULL, 'incomplete', 'incomplete', 'incomplete');
      `);
      const before = (await client.query("SELECT * FROM feedback ORDER BY id"))
        .rows;
      // The job accepts a query executor; reuse this transaction's connection.
      const executor = client as unknown as Pool;
      expect(await expireUnansweredFeedback(executor)).toBe(1);
      const after = (await client.query("SELECT * FROM feedback ORDER BY id"))
        .rows;
      expect(after[0]).toEqual({
        ...before[0],
        outcome_missing_reason: "no_reply",
      });
      expect(after.slice(1)).toEqual(before.slice(1));
      expect(await expireUnansweredFeedback(executor)).toBe(0);
      expect(
        (await client.query("SELECT * FROM feedback ORDER BY id")).rows,
      ).toEqual(after);
    } finally {
      await client.query("ROLLBACK");
      client.release();
      await pool.end();
    }
  });
});
