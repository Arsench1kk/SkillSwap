/**
 * Locale configuration shared by server and client code. Pure module: no
 * React, no Next.js, no database, so it can be imported anywhere.
 *
 * Which locales are *required* on production surfaces is decision R09; until
 * it is approved every supported locale may fall back to English per key, and
 * `npm run i18n:check` reports the gaps instead of failing.
 */
export const locales = ["en", "ru", "kk"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

/**
 * Read by the server for rendering and by the client provider. It holds only a
 * UI preference, never identity, and must not be copied into event context:
 * `ui_locale` rules are decision R10 and are set by the server (D1).
 */
export const localeCookieName = "skillswap-locale";
export const localeCookieMaxAgeSeconds = 60 * 60 * 24 * 365;

/** Legacy client-only storage key, still read once so existing choices survive. */
export const legacyLocaleStorageKey = "skillswap-language";

export function isLocale(value: unknown): value is Locale {
  return locales.some((locale) => locale === value);
}

/** BCP 47 tag for Intl formatting (dates, numbers). */
export const intlLocale: Record<Locale, string> = {
  en: "en-GB",
  ru: "ru-RU",
  kk: "kk-KZ",
};
