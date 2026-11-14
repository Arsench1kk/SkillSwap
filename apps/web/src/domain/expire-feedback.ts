import type { Pool } from "pg";

export async function expireUnansweredFeedback(pool: Pool) {
  const result = await pool.query(
    `UPDATE feedback AS f
     SET unblocked_missing_reason = CASE
           WHEN f.unblocked IS NULL AND f.unblocked_missing_reason = 'incomplete'
           THEN 'no_reply'::missing_reason ELSE f.unblocked_missing_reason END,
         outcome_missing_reason = CASE
           WHEN f.one_line_outcome IS NULL AND f.outcome_missing_reason = 'incomplete'
           THEN 'no_reply'::missing_reason ELSE f.outcome_missing_reason END,
         trust_missing_reason = CASE
           WHEN f.trust IS NULL AND f.trust_missing_reason = 'incomplete'
           THEN 'no_reply'::missing_reason ELSE f.trust_missing_reason END
     FROM sessions AS s
     WHERE s.id = f.session_id
       AND s.completion_state = 'completed'
       AND s.ends_at IS NOT NULL
       AND s.ends_at < now() - interval '2 hours'
       AND (
         (f.unblocked IS NULL AND f.unblocked_missing_reason = 'incomplete')
         OR (f.one_line_outcome IS NULL AND f.outcome_missing_reason = 'incomplete')
         OR (f.trust IS NULL AND f.trust_missing_reason = 'incomplete')
       )`,
  );
  return result.rowCount ?? 0;
}
