import { NextResponse } from "next/server";
import {
  isLocale,
  localeCookieMaxAgeSeconds,
  localeCookieName,
} from "@/src/i18n/config";
import { safeReturnPath } from "@/src/i18n/resolve";

/**
 * No-JavaScript fallback for the language switcher: a plain form POST saves the
 * UI preference cookie and returns to the same page. Stores nothing else and
 * records no event; `ui_locale` in events is set server-side under R10.
 */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const locale = form?.get("locale");
  const back = safeReturnPath(form?.get("next"));
  const response = NextResponse.redirect(new URL(back, request.url), 303);
  if (isLocale(locale)) {
    response.cookies.set(localeCookieName, locale, {
      path: "/",
      maxAge: localeCookieMaxAgeSeconds,
      sameSite: "lax",
      secure: new URL(request.url).protocol === "https:",
    });
  }
  return response;
}
