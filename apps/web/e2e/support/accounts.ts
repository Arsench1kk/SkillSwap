import { randomBytes } from "node:crypto";
import {
  expect,
  request as playwrightRequest,
  type APIRequestContext,
} from "@playwright/test";

export type AccountRole = "learner" | "mentor";

export type TestAccount = {
  email: string;
  password: string;
  role: AccountRole;
  /** Signed-in HTTP client with this account's session cookie. */
  api: APIRequestContext;
};

/**
 * Registers a real account through Better Auth's HTTP API (no SQL). The E2E
 * server runs in development on localhost with AUTH_DEV_SKIP_EMAIL_VERIFICATION,
 * so sign-up returns a session without sending email. Addresses use the
 * reserved example.com domain; data is removed by `npm run db:test:reset`.
 */
export async function createAccount(
  baseURL: string,
  role: AccountRole,
): Promise<TestAccount> {
  const suffix = randomBytes(5).toString("hex");
  const email = `e2e-${role}-${suffix}@example.com`;
  const password = `E2e-${randomBytes(9).toString("base64url")}`;
  const api = await playwrightRequest.newContext({
    baseURL,
    // Better Auth origin checks stay enabled; send the app's own origin.
    extraHTTPHeaders: { origin: baseURL },
  });
  const response = await api.post("/api/auth/sign-up/email", {
    data: { name: `E2E ${role}`, email, password, activeRole: role },
  });
  expect(response.status(), await response.text()).toBe(200);
  return { email, password, role, api };
}

export async function disposeAccounts(...accounts: TestAccount[]) {
  await Promise.all(accounts.map((account) => account.api.dispose()));
}
