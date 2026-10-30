import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { z } from "zod";
import { db } from "@/db/client";
import {
  authAccounts,
  authSessions,
  authUsers,
  authVerifications,
} from "@/db/auth-schema";

const authBaseUrl =
  process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const localEmailBypass =
  process.env.NODE_ENV === "development" &&
  process.env.AUTH_DEV_SKIP_EMAIL_VERIFICATION === "true" &&
  ["localhost", "127.0.0.1", "[::1]"].includes(new URL(authBaseUrl).hostname);
const requireEmailVerification =
  process.env.AUTH_REQUIRE_EMAIL_VERIFICATION !== "false" && !localEmailBypass;

async function sendResendEmail(input: {
  to: string;
  subject: string;
  html: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.AUTH_EMAIL_FROM;
  if (!apiKey || !from) {
    throw APIError.fromStatus("SERVICE_UNAVAILABLE", {
      message:
        "Transactional email is not configured. Set RESEND_API_KEY and AUTH_EMAIL_FROM.",
    });
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, ...input, to: [input.to] }),
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(`Email provider returned ${response.status}: ${responseText}`);
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character] ?? character;
  });
}

export const auth = betterAuth({
  appName: "SkillSwap",
  baseURL: authBaseUrl,
  secret:
    process.env.BETTER_AUTH_SECRET ??
    (process.env.NODE_ENV === "production"
      ? undefined
      : "local-development-secret-change-before-deploy-32chars"),
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: authUsers,
      session: authSessions,
      account: authAccounts,
      verification: authVerifications,
    },
  }),
  user: {
    additionalFields: {
      activeRole: {
        type: "string",
        required: false,
        defaultValue: "learner",
        input: true,
        validator: { input: z.enum(["learner", "mentor"]) },
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    sendResetPassword: async ({ user, url }) => {
      await sendResendEmail({
        to: user.email,
        subject: "Reset your SkillSwap password",
        html: `<p>Use the link below to reset your SkillSwap password.</p><p><a href="${escapeHtml(url)}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`,
      });
    },
  },
  emailVerification: {
    sendOnSignUp: requireEmailVerification,
    sendOnSignIn: requireEmailVerification,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendResendEmail({
        to: user.email,
        subject: "Verify your SkillSwap email",
        html: `<p>Welcome to SkillSwap, ${escapeHtml(user.name)}.</p><p><a href="${escapeHtml(url)}">Verify your email</a></p><p>If you did not create this account, you can ignore this email.</p>`,
      });
    },
  },
  trustedOrigins: [authBaseUrl],
});
