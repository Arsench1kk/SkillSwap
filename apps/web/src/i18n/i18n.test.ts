import { describe, expect, it } from "vitest";
import { messages } from "@/messages/en";
import { POST as setLocale } from "../../app/api/locale/route";
import { authEmailContent } from "./auth-email";
import { localeCookieName } from "./config";
import { coverageReport, keyScope, worksheetCsv } from "./coverage";
import {
  localeFromHeaders,
  matchAcceptLanguage,
  resolveLocale,
  safeReturnPath,
} from "./resolve";
import { createTranslator, hasTranslation, missingKeys } from "./translate";
import { translations } from "./translations";

describe("resolveLocale", () => {
  it("prefers explicit, then cookie, then Accept-Language, then English", () => {
    expect(resolveLocale({ explicit: "kk", cookie: "ru" })).toBe("kk");
    expect(resolveLocale({ cookie: "ru", acceptLanguage: "kk" })).toBe("ru");
    expect(resolveLocale({ acceptLanguage: "kk-KZ,ru;q=0.8" })).toBe("kk");
    expect(resolveLocale({})).toBe("en");
  });

  it("ignores unsupported or malformed values", () => {
    expect(resolveLocale({ explicit: "de", cookie: "<script>" })).toBe("en");
    expect(resolveLocale({ cookie: "RU" })).toBe("en");
  });
});

describe("matchAcceptLanguage", () => {
  it("honours q-values and order", () => {
    expect(matchAcceptLanguage("de, ru;q=0.5, kk;q=0.9")).toBe("kk");
    expect(matchAcceptLanguage("en-US,en;q=0.9,ru;q=0.8")).toBe("en");
    expect(matchAcceptLanguage("ru;q=0, kk;q=0.1")).toBe("kk");
    expect(matchAcceptLanguage("de, fr")).toBeNull();
    expect(matchAcceptLanguage(null)).toBeNull();
  });
});

describe("localeFromHeaders", () => {
  it("reads the locale cookie among others", () => {
    const headers = new Headers({
      cookie: `a=1; ${localeCookieName}=kk; b=2`,
      "accept-language": "ru",
    });
    expect(localeFromHeaders(headers)).toBe("kk");
    expect(localeFromHeaders(new Headers({ "accept-language": "ru" }))).toBe(
      "ru",
    );
    expect(localeFromHeaders(undefined)).toBe("en");
  });
});

describe("safeReturnPath", () => {
  it.each([
    ["/brief/abc", "/brief/abc"],
    ["/", "/"],
    ["//evil.example", "/"],
    ["https://evil.example", "/"],
    ["/\\evil.example", "/"],
    ["/a\r\nSet-Cookie: x", "/"],
    [null, "/"],
  ])("%s → %s", (input, expected) => {
    expect(safeReturnPath(input)).toBe(expected);
  });
});

describe("createTranslator", () => {
  it("uses the locale catalog and falls back to English per key", () => {
    const ru = createTranslator("ru");
    expect(ru("languageLabel")).toBe(translations.ru.languageLabel);
    const missing = missingKeys("ru")[0];
    expect(missing).toBeDefined();
    expect(ru(missing!)).toBe(messages[missing!]);
    expect(createTranslator("en")("brand")).toBe(messages.brand);
    expect(hasTranslation("en", "brand")).toBe(true);
  });
});

describe("coverage", () => {
  it("classifies dev and workspace keys separately from production", () => {
    expect(keyScope("kitTitle")).toBe("dev");
    expect(keyScope("brand")).toBe("untranslated");
    expect(keyScope("prototypeSkillRemovalAction")).toBe("workspace");
    expect(keyScope("briefOpsReplyHours")).toBe("production");
  });

  it("has no placeholder mismatches in existing translations", () => {
    expect(coverageReport("ru").placeholderMismatches).toEqual([]);
    expect(coverageReport("kk").placeholderMismatches).toEqual([]);
  });

  it("exports a quoted CSV worksheet without dev keys", () => {
    const csv = worksheetCsv("kk");
    expect(csv.startsWith("key,scope,en,kk\n")).toBe(true);
    expect(csv).not.toContain('"kitTitle"');
  });
});

describe("authEmailContent", () => {
  it("keeps the current English wording and escapes input", () => {
    const email = authEmailContent("verify-email", "en", {
      url: "https://app.example/verify?a=1&b=2",
      name: "<Aru>",
    });
    expect(email.subject).toBe("Verify your SkillSwap email");
    expect(email.html).toContain("Welcome to SkillSwap, &lt;Aru&gt;.");
    expect(email.html).toContain(
      'href="https://app.example/verify?a=1&amp;b=2"',
    );
    const reset = authEmailContent("reset-password", "ru", { url: "u" });
    expect(reset.subject).toBe(createTranslator("ru")("authEmailResetSubject"));
  });
});

describe("POST /api/locale", () => {
  function post(fields: Record<string, string>) {
    const body = new FormData();
    for (const [key, value] of Object.entries(fields)) body.set(key, value);
    return setLocale(
      new Request("http://localhost:3000/api/locale", { method: "POST", body }),
    );
  }

  it("sets the cookie and returns to the same page", async () => {
    const response = await post({ locale: "kk", next: "/brief/token" });
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/brief/token",
    );
    expect(response.headers.get("set-cookie")).toContain(
      `${localeCookieName}=kk`,
    );
  });

  it("rejects unknown locales and external redirects", async () => {
    const response = await post({ locale: "de", next: "//evil.example" });
    expect(response.headers.get("location")).toBe("http://localhost:3000/");
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
