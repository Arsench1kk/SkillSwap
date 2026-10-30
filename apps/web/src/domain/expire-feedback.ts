import type { Pool } from "pg";

export async function expireUnansweredFeedback(pool: Pool) {
  const result = await pool.query(
    `UPDATE feedback AS f
     SET unblocked_missing_reason = CASE
           WHEN f.unblocked IS NULL THEN 'no_reply'::missing_reason ELSE NULL END,
         outcome_missing_reason = CASE
           WHEN f.one_line_outcome IS NULL THEN 'no_reply'::missing_reason ELSE NULL END,
         trust_missing_reason = CASE
           WHEN f.trust IS NULL THEN 'no_reply'::missing_reason ELSE NULL END
     FROM sessions AS s
     WHERE s.id = f.session_id
       AND s.completion_state = 'completed'
       AND s.ends_at IS NOT NULL
       AND s.ends_at <= now() - interval '2 hours'
       AND (f.unblocked IS NULL OR f.one_line_outcome IS NULL OR f.trust IS NULL)`,
  );
  return result.rowCount ?? 0;
}
