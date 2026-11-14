import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db, pool } from "@/db/client";
import { authUsers } from "@/db/auth-schema";

describe.skipIf(!process.env.DATABASE_URL)(
  "account boundary with real Better Auth sessions",
  () => {
    const accountIds: string[] = [];
    let auth: (typeof import("./auth"))["auth"];
    let requireAccountSession: (typeof import("./account-session"))["requireAccountSession"];

    beforeAll(async () => {
      // Only this isolated test module uses the library's email-free local mode.
      // No real provider credentials or outgoing verification/reset mail are used.
      vi.stubEnv("AUTH_REQUIRE_EMAIL_VERIFICATION", "false");
      vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
      vi.stubEnv(
        "BETTER_AUTH_SECRET",
        "d1-synthetic-test-secret-at-least-32-characters",
      );
      vi.stubEnv("RESEND_API_KEY", "");
      vi.stubEnv("AUTH_EMAIL_FROM", "");
      ({ auth } = await import("./auth"));
      ({ requireAccountSession } = await import("./account-session"));
    });

    afterAll(async () => {
      try {
        if (accountIds.length)
          await db.delete(authUsers).where(inArray(authUsers.id, accountIds));
      } finally {
        vi.unstubAllEnvs();
        await pool.end();
      }
    });

    async function signUp(activeRole: "learner" | "mentor") {
      const email = `${randomUUID()}@example.test`;
      const password = "Synthetic-account-password-123";
      const response = await auth.api.signUpEmail({
        body: { name: "SYNTHETIC ACCOUNT", email, password, activeRole },
        asResponse: true,
      });
      expect(response.status).toBe(200);
      const result = await response.json();
      accountIds.push(result.user.id);
      const cookie = response.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ");
      expect(cookie).not.toBe("");
      return {
        id: result.user.id as string,
        email,
        password,
        headers: new Headers({ cookie }),
      };
    }

    it("isolates two authenticated accounts and reads their actual stored roles", async () => {
      const learner = await signUp("learner");
      const mentor = await signUp("mentor");
      learner.headers.set("x-user-id", mentor.id);
      learner.headers.set("x-active-role", "mentor");

      await expect(
        requireAccountSession(learner.headers, "learner"),
      ).resolves.toEqual({ authUserId: learner.id, activeRole: "learner" });
      await expect(
        requireAccountSession(mentor.headers, "mentor"),
      ).resolves.toEqual({ authUserId: mentor.id, activeRole: "mentor" });
      await expect(
        requireAccountSession(learner.headers, "mentor"),
      ).rejects.toMatchObject({ code: "active_role_required" });
    });

    it("uses Better Auth role changes and rejects a revoked session", async () => {
      const account = await signUp("learner");
      await auth.api.updateUser({
        headers: account.headers,
        body: { activeRole: "mentor" },
      });
      await expect(
        requireAccountSession(account.headers, "mentor"),
      ).resolves.toEqual({ authUserId: account.id, activeRole: "mentor" });

      await auth.api.signOut({ headers: account.headers });
      await expect(
        requireAccountSession(account.headers),
      ).rejects.toMatchObject({ code: "unauthorized" });

      const signIn = await auth.api.signInEmail({
        body: { email: account.email, password: account.password },
        asResponse: true,
      });
      expect(signIn.status).toBe(200);
      const cookie = signIn.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ");
      await expect(
        requireAccountSession(new Headers({ cookie }), "mentor"),
      ).resolves.toEqual({ authUserId: account.id, activeRole: "mentor" });
    });

    it("rejects a tampered cookie instead of accepting a claimed account", async () => {
      const account = await signUp("learner");
      const headers = new Headers({
        cookie: "better-auth.session_token=invalid.synthetic.signature",
        "x-user-id": account.id,
      });
      await expect(requireAccountSession(headers)).rejects.toMatchObject({
        code: "unauthorized",
      });
    });
  },
);
