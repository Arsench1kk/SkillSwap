import type { Locale } from "./config";
import { createTranslator } from "./translate";

export type AuthEmailKind = "verify-email" | "reset-password";
export type AuthEmail = { subject: string; html: string };

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

/**
 * Localized subject and body for Better Auth emails. The caller (D1, in
 * src/lib/auth.ts) resolves the locale, e.g. with `localeFromHeaders` from the
 * callback's Request; the URL and name are escaped here.
 */
export function authEmailContent(
  kind: AuthEmailKind,
  locale: Locale,
  input: { url: string; name?: string },
): AuthEmail {
  const t = createTranslator(locale);
  const link = (label: string) =>
    `<p><a href="${escapeHtml(input.url)}">${escapeHtml(label)}</a></p>`;
  if (kind === "verify-email") {
    const greeting = t("authEmailVerifyGreeting").replace(
      "{name}",
      input.name ?? "",
    );
    return {
      subject: t("authEmailVerifySubject"),
      html: `<p>${escapeHtml(greeting)}</p>${link(t("authEmailVerifyAction"))}<p>${escapeHtml(t("authEmailVerifyIgnore"))}</p>`,
    };
  }
  return {
    subject: t("authEmailResetSubject"),
    html: `<p>${escapeHtml(t("authEmailResetIntro"))}</p>${link(t("authEmailResetAction"))}<p>${escapeHtml(t("authEmailResetIgnore"))}</p>`,
  };
}
