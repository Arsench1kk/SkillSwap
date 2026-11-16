import { messages, type MessageKey } from "@/messages/en";
import { locales, type Locale } from "./config";
import { translations, type TranslationCatalog } from "./translations";

/**
 * Proposed grouping of catalog keys by surface for coverage reports. The
 * approved production scope is decision R09; until then only `dev` and
 * `untranslated` are excluded from "production" counts, and nothing fails on
 * missing keys unless locales are passed to `--require`.
 */
export type KeyScope = "dev" | "untranslated" | "workspace" | "production";

const scopeRules: Array<[RegExp, KeyScope]> = [
  [/^kit/, "dev"], // /dev/kit design kit, not shipped to users
  [/^brand$/, "untranslated"], // product name
  [/^prototype/, "workspace"], // account workspace, still contains demo data
];

export function keyScope(key: MessageKey): KeyScope {
  return scopeRules.find(([pattern]) => pattern.test(key))?.[1] ?? "production";
}

function placeholders(text: string) {
  return [...text.matchAll(/\{([a-zA-Z]+)\}/g)].map((m) => m[1]).sort();
}

export type CoverageReport = {
  locale: Exclude<Locale, "en">;
  total: number;
  missing: Record<KeyScope, MessageKey[]>;
  placeholderMismatches: MessageKey[];
};

export function coverageReport(locale: Exclude<Locale, "en">): CoverageReport {
  const catalog: TranslationCatalog = translations[locale];
  const keys = Object.keys(messages) as MessageKey[];
  const missing: CoverageReport["missing"] = {
    dev: [],
    untranslated: [],
    workspace: [],
    production: [],
  };
  const placeholderMismatches: MessageKey[] = [];
  for (const key of keys) {
    const translated = catalog[key];
    if (!translated) {
      missing[keyScope(key)].push(key);
      continue;
    }
    const expected = placeholders(messages[key]).join(",");
    if (placeholders(translated).join(",") !== expected) {
      placeholderMismatches.push(key);
    }
  }
  return { locale, total: keys.length, missing, placeholderMismatches };
}

export const translatedLocales = locales.filter(
  (locale): locale is Exclude<Locale, "en"> => locale !== "en",
);

/** CSV rows (key, scope, English source) for a translator worksheet. */
export function worksheetCsv(locale: Exclude<Locale, "en">): string {
  const report = coverageReport(locale);
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const rows = (["production", "workspace"] as const).flatMap((scope) =>
    report.missing[scope].map((key) =>
      [key, scope, messages[key], ""].map(quote).join(","),
    ),
  );
  return [`key,scope,en,${locale}`, ...rows].join("\n") + "\n";
}
