import { messages, type MessageKey } from "../../messages/en";
import {
  translations,
  type Language,
  type TranslationCatalog,
} from "./translations";

export type TranslatedLanguage = Exclude<Language, "en">;

/** Keys that intentionally fall back to English, per language. */
export type MissingTranslationBaseline = Record<TranslatedLanguage, string[]>;

export const translatedLanguages = Object.keys(
  translations,
) as TranslatedLanguage[];

const allKeys = Object.keys(messages) as MessageKey[];
const placeholderPattern = /\{[a-zA-Z][a-zA-Z0-9]*\}/g;

function catalogFor(language: TranslatedLanguage): TranslationCatalog {
  return translations[language];
}

/** Sorted `{name}` placeholders, so word order may differ between languages. */
export function placeholdersOf(text: string): string[] {
  return [...new Set(text.match(placeholderPattern) ?? [])].sort();
}

/** English keys with no entry in the language catalog, in catalog order. */
export function missingKeys(language: TranslatedLanguage): MessageKey[] {
  const catalog = catalogFor(language);
  return allKeys.filter((key) => catalog[key] === undefined);
}

export type CatalogProblem = {
  language: TranslatedLanguage;
  key: string;
  problem: "empty" | "placeholders";
  detail?: string;
};

/** Translations that exist but would render wrongly. */
export function catalogProblems(): CatalogProblem[] {
  const problems: CatalogProblem[] = [];
  for (const language of translatedLanguages) {
    const catalog = catalogFor(language);
    for (const key of allKeys) {
      const value = catalog[key];
      if (value === undefined) continue;
      if (value.trim() === "") {
        problems.push({ language, key, problem: "empty" });
        continue;
      }
      const expected = placeholdersOf(messages[key]);
      const actual = placeholdersOf(value);
      if (expected.join() !== actual.join()) {
        problems.push({
          language,
          key,
          problem: "placeholders",
          detail: `expected [${expected.join(", ")}], found [${actual.join(", ")}]`,
        });
      }
    }
  }
  return problems;
}

export type BaselineDrift = {
  language: TranslatedLanguage;
  /** Missing now but not accepted in the baseline: a new untranslated key. */
  newlyMissing: string[];
  /** Accepted in the baseline but now translated or deleted: tighten it. */
  stale: string[];
};

export function compareWithBaseline(
  baseline: MissingTranslationBaseline,
): BaselineDrift[] {
  return translatedLanguages.map((language) => {
    const missing = new Set<string>(missingKeys(language));
    const accepted = new Set(baseline[language] ?? []);
    return {
      language,
      newlyMissing: [...missing].filter((key) => !accepted.has(key)),
      stale: [...accepted].filter((key) => !missing.has(key)),
    };
  });
}

export function buildBaseline(): MissingTranslationBaseline {
  return Object.fromEntries(
    translatedLanguages.map((language) => [language, missingKeys(language)]),
  ) as MissingTranslationBaseline;
}

/** Leading lower-case word of a key, e.g. `prototypeSearch` → `prototype`. */
export function keyGroup(key: string): string {
  return key.match(/^[a-z]+/)?.[0] ?? key;
}

export type GroupCoverage = {
  group: string;
  total: number;
  missing: Record<TranslatedLanguage, number>;
};

export function coverageByGroup(): GroupCoverage[] {
  const groups = new Map<string, GroupCoverage>();
  const empty = () =>
    Object.fromEntries(translatedLanguages.map((l) => [l, 0])) as Record<
      TranslatedLanguage,
      number
    >;
  for (const key of allKeys) {
    const group = keyGroup(key);
    const entry = groups.get(group) ?? { group, total: 0, missing: empty() };
    entry.total += 1;
    for (const language of translatedLanguages) {
      if (catalogFor(language)[key] === undefined) entry.missing[language] += 1;
    }
    groups.set(group, entry);
  }
  return [...groups.values()].sort((a, b) => b.total - a.total);
}

export const totalKeys = allKeys.length;
