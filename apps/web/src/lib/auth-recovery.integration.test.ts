import { randomUUID } from "node:crypto";
import { createEmailVerificationToken } from "better-auth/api";
import { eq, inArray } from "drizzle-orm";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { db, pool } from "@/db/client";
import { authUsers, authVerifications } from "@/db/auth-schema";

describe.skipIf(!process.env.DATABASE_URL)(
  "Better Auth verification and recovery",
  () => {
    const accountIds: string[] = [];
    const mail: { to: string[]; html: string }[] = [];
    const fetchMail = vi.fn(async (_url: unknown, init?: RequestInit) => {
      mail.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({ id: "synthetic-mail" }), {
        status: 200,
      });
    });
    let auth: (typeof import("./auth"))["auth"];

    beforeAll(async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("AUTH_REQUIRE_EMAIL_VERIFICATION", "true");
      vi.stubEnv("AUTH_DEV_SKIP_EMAIL_VERIFICATION", "false");
      vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
      vi.stubEnv(
        "BETTER_AUTH_SECRET",
        "synthetic-recovery-secret-at-least-32-characters",
      );
      vi.stubEnv("RESEND_API_KEY", "synthetic-not-a-real-key");
      vi.stubEnv("AUTH_EMAIL_FROM", "SkillSwap <synthetic@example.test>");
      // The real auth API and Drizzle adapter run; only outgoing HTTP mail is mocked.
      vi.stubGlobal("fetch", fetchMail);
      ({ auth } = await import("./auth"));
    });
    beforeEach(() => {
      mail.length = 0;
      fetchMail.mockClear();
    });
    afterAll(async () => {
      try {
        if (accountIds.length) {
          await db
            .delete(authVerifications)
            .where(inArray(authVerifications.value, accountIds));
          await db.delete(authUsers).where(inArray(authUsers.id, accountIds));
        }
      } finally {
        vi.unstubAllGlobals();
        vi.unstubAllEnvs();
        await pool.end();
      }
    });

    const password = "Synthetic-original-password-123";
    const newPassword = "Synthetic-replacement-password-456";

    async function signUp() {
      const email = `${randomUUID()}@example.test`;
      const response = await auth.api.signUpEmail({
        body: {
          name: "SYNTHETIC <ACCOUNT>",
          email,
          password,
          activeRole: "mentor",
        },
        asResponse: true,
      });
      expect(response.status).toBe(200);
      const result = await response.json();
      accountIds.push(result.user.id);
      expect(result.token).toBeNull();
      expect(mail.at(-1)?.to).toEqual([email]);
      expect(mail.at(-1)?.html).toContain("&lt;ACCOUNT&gt;");
      return { id: result.user.id as string, email };
    }

    function mailUrl() {
      const href = /href="([^"]+)"/.exec(mail.at(-1)!.html)![1];
      return new URL(href.replaceAll("&amp;", "&"));
    }

    async function verify() {
      const token = mailUrl().searchParams.get("token")!;
      const response = await auth.api.verifyEmail({
        query: { token },
        asResponse: true,
      });
      expect(response.status).toBe(200);
    }

    async function resetToken(email: string) {
      const response = await auth.api.requestPasswordReset({
        body: { email, redirectTo: "http://localhost:3000/reset-password" },
        asResponse: true,
      });
      expect(response.status).toBe(200);
      return mailUrl().pathname.split("/").at(-1)!;
    }

    it("blocks unverified sign-in, resends verification, then permits a real session", async () => {
      const account = await signUp();
      const denied = await auth.api.signInEmail({
        body: { email: account.email, password },
        asResponse: true,
      });
      expect(denied.status).toBe(403);
      expect((await denied.json()).code).toBe("EMAIL_NOT_VERIFIED");
      const before = mail.length;
      await auth.api.sendVerificationEmail({ body: { email: account.email } });
      expect(mail).toHaveLength(before + 1);
      await verify();
      const signedIn = await auth.api.signInEmail({
        body: { email: account.email, password },
        asResponse: true,
      });
      expect(signedIn.status).toBe(200);
      const cookie = signedIn.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ");
      const session = await auth.api.getSession({
        headers: new Headers({ cookie }),
      });
      expect(session?.user).toMatchObject({
        id: account.id,
        emailVerified: true,
        activeRole: "mentor",
      });
    });

    it("rejects a tampered verification token without verifying the account", async () => {
      const account = await signUp();
      const token = mailUrl().searchParams.get("token")!;
      const rejected = await auth.api.verifyEmail({
        query: { token: `invalid.${token}` },
        asResponse: true,
      });
      expect(rejected.status).toBe(401);
      const [stored] = await db
        .select()
        .from(authUsers)
        .where(eq(authUsers.id, account.id));
      expect(stored.emailVerified).toBe(false);
    });

    it("rejects an expired signed verification link without verifying the account", async () => {
      const account = await signUp();
      const token = await createEmailVerificationToken(
        process.env.BETTER_AUTH_SECRET!,
        account.email,
        undefined,
        -60,
      );
      const response = await auth.api.verifyEmail({
        query: { token },
        asResponse: true,
      });
      expect(response.status).toBe(401);
      expect((await response.json()).code).toBe("TOKEN_EXPIRED");
      const [stored] = await db
        .select()
        .from(authUsers)
        .where(eq(authUsers.id, account.id));
      expect(stored.emailVerified).toBe(false);
    });

    it("rejects a missing reset token", async () => {
      const response = await auth.api.resetPassword({
        body: { newPassword },
        asResponse: true,
      });
      expect(response.status).toBe(400);
      expect((await response.json()).code).toBe("INVALID_TOKEN");
    });

    it("returns the same reset-request result for known and unknown email", async () => {
      const account = await signUp();
      const known = await auth.api.requestPasswordReset({
        body: { email: account.email },
        asResponse: true,
      });
      const before = mail.length;
      const unknown = await auth.api.requestPasswordReset({
        body: { email: `${randomUUID()}@example.test` },
        asResponse: true,
      });
      expect(known.status).toBe(unknown.status);
      expect(await known.json()).toEqual(await unknown.json());
      expect(mail).toHaveLength(before);
    });

    it("changes only the target password and consumes the reset token once", async () => {
      const account = await signUp();
      await verify();
      const other = await signUp();
      await verify();
      const token = await resetToken(account.email);
      const reset = await auth.api.resetPassword({
        body: { token, newPassword },
        asResponse: true,
      });
      expect(reset.status).toBe(200);
      const replay = await auth.api.resetPassword({
        body: { token, newPassword: password },
        asResponse: true,
      });
      expect(replay.status).toBe(400);
      const old = await auth.api.signInEmail({
        body: { email: account.email, password },
        asResponse: true,
      });
      expect(old.status).toBe(401);
      const current = await auth.api.signInEmail({
        body: { email: account.email, password: newPassword },
        asResponse: true,
      });
      expect(current.status).toBe(200);
      const untouched = await auth.api.signInEmail({
        body: { email: other.email, password },
        asResponse: true,
      });
      expect(untouched.status).toBe(200);
    });

    it("rejects expired and unknown reset tokens without changing the password", async () => {
      const account = await signUp();
      await verify();
      const token = await resetToken(account.email);
      await db
        .update(authVerifications)
        .set({ expiresAt: new Date(Date.now() - 60_000) })
        .where(eq(authVerifications.identifier, `reset-password:${token}`));
      for (const invalid of [token, "unknown-synthetic-token"]) {
        const response = await auth.api.resetPassword({
          body: { token: invalid, newPassword },
          asResponse: true,
        });
        expect(response.status).toBe(400);
      }
      const signIn = await auth.api.signInEmail({
        body: { email: account.email, password },
        asResponse: true,
      });
      expect(signIn.status).toBe(200);
    });

    it.each(["short", "x".repeat(129)])(
      "rejects an invalid new password without spending the token (%#)",
      async (invalid) => {
        const account = await signUp();
        const token = await resetToken(account.email);
        const rejected = await auth.api.resetPassword({
          body: { token, newPassword: invalid },
          asResponse: true,
        });
        expect(rejected.status).toBe(400);
        const retry = await auth.api.resetPassword({
          body: { token, newPassword },
          asResponse: true,
        });
        expect(retry.status).toBe(200);
      },
    );

    it("rejects an external reset redirect without sending a private link", async () => {
      const account = await signUp();
      const before = mail.length;
      const response = await auth.handler(
        new Request("http://localhost:3000/api/auth/request-password-reset", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            origin: "http://localhost:3000",
          },
          body: JSON.stringify({
            email: account.email,
            redirectTo: "https://untrusted.example.test/reset",
          }),
        }),
      );
      expect(response.status).toBe(403);
      expect(mail).toHaveLength(before);
    });

    it("keeps private provider response text out of logged delivery errors", async () => {
      const account = await signUp();
      fetchMail.mockResolvedValueOnce(
        new Response(
          "private-recipient@example.test token=synthetic-private-token",
          { status: 503 },
        ),
      );
      const errors = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        // Better Auth logs delivery failures and preserves its generic response.
        await expect(
          auth.api.requestPasswordReset({ body: { email: account.email } }),
        ).resolves.toMatchObject({ status: true });
        const diagnostic = errors.mock.calls.flat().map(String).join(" ");
        expect(diagnostic).toContain("Email provider returned 503");
        expect(diagnostic).not.toContain("private-recipient@example.test");
        expect(diagnostic).not.toContain("synthetic-private-token");
      } finally {
        errors.mockRestore();
      }
    });

    it("logs missing provider configuration without attempting HTTP delivery", async () => {
      const account = await signUp();
      const before = fetchMail.mock.calls.length;
      const errors = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.stubEnv("RESEND_API_KEY", "");
      try {
        await expect(
          auth.api.requestPasswordReset({ body: { email: account.email } }),
        ).resolves.toMatchObject({ status: true });
        expect(errors.mock.calls.flat().map(String).join(" ")).toContain(
          "Transactional email is not configured",
        );
        expect(fetchMail).toHaveBeenCalledTimes(before);
      } finally {
        errors.mockRestore();
        vi.stubEnv("RESEND_API_KEY", "synthetic-not-a-real-key");
      }
    });
  },
);
