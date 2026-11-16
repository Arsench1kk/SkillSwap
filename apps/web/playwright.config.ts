import { defineConfig } from "@playwright/test";
import { describeTarget, requireTestDatabase } from "./testing/database-target";

// E2E always needs a database. Resolve and verify it once, before any spec
// module opens a pool, and hand the same URL to the app server so fixtures and
// the app never diverge (an explicit env beats `.env.local` in Next.js).
const database = requireTestDatabase(process.env);
process.env.DATABASE_URL = database.url;
console.log(`[e2e] database ${describeTarget(database)}`);

// A separate port so a developer's own `npm run dev` (on the dev database) is
// never silently reused while fixtures go to the test database.
const port = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  use: {
    baseURL,
    trace: process.env.CI ? "retain-on-failure" : "off",
  },
  webServer: {
    command: `npm run dev -- --port ${port}`,
    url: baseURL,
    // Opt in only when that server was started with the same test database.
    reuseExistingServer: process.env.E2E_REUSE_SERVER === "1",
    timeout: 120_000,
    env: {
      DATABASE_URL: database.url,
      SKILLSWAP_DATA_ORIGIN: "rehearsal",
      // Development + localhost only (enforced in src/lib/auth.ts): lets the
      // release journey register real accounts without sending email.
      AUTH_DEV_SKIP_EMAIL_VERIFICATION: "true",
      BETTER_AUTH_URL: baseURL,
      NEXT_PUBLIC_APP_URL: baseURL,
    },
  },
});
