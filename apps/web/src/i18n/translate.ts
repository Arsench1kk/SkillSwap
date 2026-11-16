import { messages, type MessageKey } from "@/messages/en";
import { defaultLocale, locales, type Locale } from "./config";
import { translations, type TranslationCatalog } from "./translations";

export type Translator = (key: MessageKey) => string;

function catalogFor(locale: Locale): TranslationCatalog | null {
  return locale === "en" ? null : translations[locale];
}

/**
 * One lookup for server components, route handlers, emails and the client
 * provider. A missing key falls back to English until R09 says which locales
 * must be complete; `missingKeys` and `npm run i18n:check` report the gaps.
 */
export function createTranslator(locale: Locale): Translator {
  const catalog = catalogFor(locale);
  return (key) => catalog?.[key] ?? messages[key];
}

export function hasTranslation(locale: Locale, key: MessageKey): boolean {
  if (locale === defaultLocale) return true;
  return Boolean(catalogFor(locale)?.[key]);
}

export function missingKeys(locale: Locale): MessageKey[] {
  return (Object.keys(messages) as MessageKey[]).filter(
    (key) => !hasTranslation(locale, key),
  );
}

export { locales };
