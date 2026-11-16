import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describeTarget, resolveTestDatabase } from "./testing/database-target";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

// Verify the database before any test module can open a pool. An unsafe
// target throws here, so no fixture or cleanup code ever runs against it.
const database = resolveTestDatabase(process.env);
if (database) {
  console.log(`[vitest] database ${describeTarget(database)}`);
} else {
  console.warn(
    "[vitest] No test database configured: PostgreSQL suites are SKIPPED. " +
      "Run `npm run db:test:prepare && npm run test:db` for the full suite.",
  );
}

export default defineConfig({
  resolve: {
    alias: [
      { find: "@/src", replacement: path.resolve(rootDir, "src") },
      { find: "@/db", replacement: path.resolve(rootDir, "src/db") },
      { find: "@/domain", replacement: path.resolve(rootDir, "src/domain") },
      { find: "@/messages", replacement: path.resolve(rootDir, "messages") },
      { find: "@/lib", replacement: path.resolve(rootDir, "src/lib") },
      {
        find: "@/components",
        replacement: path.resolve(rootDir, "components"),
      },
    ],
  },
  test: {
    include: ["src/**/*.test.ts", "testing/**/*.test.ts"],
    // Existing suites gate on DATABASE_URL; give them only the verified URL.
    env: database ? { DATABASE_URL: database.url } : { DATABASE_URL: "" },
  },
});
