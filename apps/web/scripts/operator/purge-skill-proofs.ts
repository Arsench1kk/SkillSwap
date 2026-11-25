import { db, pool } from "../../src/db/client";
import { purgeExpiredSkillProof } from "../../src/domain/skill-proof-retention";

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("Set DATABASE_URL to the target environment.");
  }
  const count = await purgeExpiredSkillProof(db);
  console.info(`Removed ${count} expired skill proof reference(s).`);
}

main()
  .catch(() => {
    console.error("Skill proof cleanup did not complete.");
    process.exitCode = 1;
  })
  .finally(() => pool.end());
