/**
 * Creates (or with --reset, drops and recreates) the verified test database,
 * then applies all migrations to it. Events are append-only, so synthetic test
 * data is removed by recreating the whole disposable database, never by
 * DELETE on an arbitrary DATABASE_URL.
 *
 *   npm run db:test:prepare            # create if missing + migrate
 *   npm run db:test:reset              # drop + create + migrate
 *   npm run db:test:reset -- --migrations-dir <dir>
 *       # migrate with an older checkout's drizzle/ folder (upgrade check)
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Client } from "pg";
import { describeTarget, requireTestDatabase } from "./database-target";

async function main() {
  const reset = process.argv.includes("--reset");
  const dirFlag = process.argv.indexOf("--migrations-dir");
  const migrationsDir =
    dirFlag === -1 ? null : path.resolve(process.argv[dirFlag + 1] ?? "");
  const target = requireTestDatabase(process.env);
  console.log(`[test-db] target ${describeTarget(target)}`);

  const maintenanceUrl = new URL(target.url);
  maintenanceUrl.pathname = "/postgres";
  const admin = new Client({ connectionString: maintenanceUrl.toString() });
  await admin.connect();
  try {
    const quoted = `"${target.database.replaceAll('"', '""')}"`;
    if (reset) {
      await admin.query(`DROP DATABASE IF EXISTS ${quoted} WITH (FORCE)`);
      console.log("[test-db] dropped");
    }
    const existing = await admin.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [target.database],
    );
    if (existing.rowCount === 0) {
      await admin.query(`CREATE DATABASE ${quoted}`);
      console.log("[test-db] created");
    }
  } finally {
    await admin.end();
  }

  const args = ["drizzle-kit", "migrate"];
  if (migrationsDir) {
    const configPath = path.join(
      mkdtempSync(path.join(tmpdir(), "skillswap-migrate-")),
      "drizzle.config.ts",
    );
    writeFileSync(
      configPath,
      // The URL stays in the child's env, not in the temporary file.
      `export default { dialect: "postgresql", out: ${JSON.stringify(
        migrationsDir,
      )}, dbCredentials: { url: process.env.DATABASE_URL } };\n`,
    );
    args.push("--config", configPath);
    console.log(`[test-db] migrations from ${migrationsDir}`);
  }
  const migrate = spawnSync("npx", args, {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: target.url },
  });
  if (migrate.status !== 0) {
    throw new Error(`drizzle-kit migrate exited with ${migrate.status}`);
  }
  console.log("[test-db] migrations applied");
}

main().catch((error: unknown) => {
  console.error(
    `[test-db] ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
