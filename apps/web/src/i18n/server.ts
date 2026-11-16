import { cookies, headers } from "next/headers";
import { localeCookieName, type Locale } from "./config";
import { resolveLocale } from "./resolve";
import { createTranslator, type Translator } from "./translate";

/**
 * Locale for the current request in server components and route handlers.
 * Reads request data, so call it inside a dynamic segment or a Suspense
 * boundary (cacheComponents is enabled). Private-link pages are dynamic.
 */
export async function getRequestLocale(): Promise<Locale> {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  return resolveLocale({
    cookie: cookieStore.get(localeCookieName)?.value,
    acceptLanguage: headerStore.get("accept-language"),
  });
}

export async function getServerTranslator(): Promise<{
  locale: Locale;
  t: Translator;
}> {
  const locale = await getRequestLocale();
  return { locale, t: createTranslator(locale) };
}
