import {
  defaultLocale,
  isLocale,
  localeCookieName,
  locales,
  type Locale,
} from "./config";

export type LocaleSources = {
  /** An explicit choice for this request, e.g. a validated `?lang=` value. */
  explicit?: string | null;
  /** The `skillswap-locale` cookie value. */
  cookie?: string | null;
  /** The raw `Accept-Language` header. */
  acceptLanguage?: string | null;
};

/**
 * Picks the UI locale for a request, identically on server and client:
 * explicit choice → saved cookie → browser Accept-Language → English.
 * Unknown values are ignored, never echoed back.
 */
export function resolveLocale(sources: LocaleSources): Locale {
  if (isLocale(sources.explicit)) return sources.explicit;
  if (isLocale(sources.cookie)) return sources.cookie;
  return matchAcceptLanguage(sources.acceptLanguage) ?? defaultLocale;
}

/** Best supported locale from an Accept-Language header, honouring q-values. */
export function matchAcceptLanguage(
  header: string | null | undefined,
): Locale | null {
  if (!header) return null;
  const ranked = header
    .split(",")
    .map((part, index) => {
      const [tag = "", ...params] = part.trim().split(";");
      const q = params
        .map((param) => param.trim())
        .find((param) => param.startsWith("q="));
      const quality = q ? Number(q.slice(2)) : 1;
      return {
        language: tag.toLowerCase().split("-")[0],
        quality: Number.isFinite(quality) ? quality : 0,
        index,
      };
    })
    .filter((entry) => entry.quality > 0)
    .sort((a, b) => b.quality - a.quality || a.index - b.index);
  for (const entry of ranked) {
    const match = locales.find((locale) => locale === entry.language);
    if (match) return match;
  }
  return null;
}

/**
 * Accepts only same-site relative paths for the no-JS language form redirect,
 * so the endpoint cannot be used as an open redirect.
 */
export function safeReturnPath(value: unknown): string {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  if (value.includes("\\") || /[\r\n]/.test(value)) return "/";
  return value;
}

/**
 * Locale from a Request's headers, for route handlers and auth callbacks
 * (for example Better Auth email callbacks) that hold the Request.
 */
export function localeFromHeaders(headers: Headers | undefined): Locale {
  const cookie = (headers?.get("cookie") ?? "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${localeCookieName}=`))
    ?.slice(localeCookieName.length + 1);
  return resolveLocale({
    cookie,
    acceptLanguage: headers?.get("accept-language"),
  });
}
