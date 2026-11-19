import { Pool } from "pg";
import { requireTestDatabase } from "../../testing/database-target";

/**
 * Shared pool for E2E fixtures. Re-verifies the target in the worker so a spec
 * can never fall back to the development database, even if run outside the
 * Playwright config. Create one pool per spec file and end it in afterAll.
 */
export function createFixturePool() {
  return new Pool({
    connectionString: requireTestDatabase(process.env).url,
  });
}
