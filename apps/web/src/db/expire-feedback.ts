import { Pool } from "pg";
import { expireUnansweredFeedback } from "@/domain/expire-feedback";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

expireUnansweredFeedback(pool)
  .then((count) => {
    console.info(`Marked ${count} overdue feedback record(s).`);
  })
  .catch((error: unknown) => {
    console.error(
      "Feedback expiry failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
