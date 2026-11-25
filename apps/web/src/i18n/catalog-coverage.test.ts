import { describe, expect, it } from "vitest";
import { messages } from "../../messages/en";
import baseline from "./missing-translations.baseline.json";
import {
  catalogProblems,
  compareWithBaseline,
  keyGroup,
  placeholdersOf,
  translatedLanguages,
  type MissingTranslationBaseline,
} from "./catalog-coverage";

describe("translation catalogs", () => {
  it("covers Russian and Kazakh", () => {
    expect([...translatedLanguages].sort()).toEqual(["kk", "ru"]);
  });

  it("has no empty translations or mismatched placeholders", () => {
    expect(catalogProblems()).toEqual([]);
  });

  it("adds no new untranslated key beyond the accepted baseline", () => {
    const drift = compareWithBaseline(baseline as MissingTranslationBaseline);
    for (const { language, newlyMissing } of drift) {
      expect(
        newlyMissing,
        `${language} is missing new keys. Translate them in src/i18n/translations.ts, ` +
          "or accept the fallback on purpose with `npm run i18n:report -- --write`.",
      ).toEqual([]);
    }
  });

  it("keeps the baseline tight once keys are translated or removed", () => {
    const drift = compareWithBaseline(baseline as MissingTranslationBaseline);
    for (const { language, stale } of drift) {
      expect(
        stale,
        `${language} baseline lists keys that are no longer missing. ` +
          "Run `npm run i18n:report -- --write`.",
      ).toEqual([]);
    }
  });

  it("only lists English keys in the baseline", () => {
    const known = new Set(Object.keys(messages));
    for (const language of translatedLanguages) {
      const unknown = (baseline as MissingTranslationBaseline)[language].filter(
        (key) => !known.has(key),
      );
      expect(unknown).toEqual([]);
    }
  });
});

describe("coverage helpers", () => {
  it("compares placeholders regardless of order and repetition", () => {
    expect(placeholdersOf("{hours} h before {date}, {hours}")).toEqual([
      "{date}",
      "{hours}",
    ]);
    expect(placeholdersOf("No placeholders")).toEqual([]);
  });

  it("groups keys by their leading word", () => {
    expect(keyGroup("prototypeSearchTitle")).toBe("prototype");
    expect(keyGroup("brand")).toBe("brand");
  });

  it("flags new gaps and stale entries against a baseline", () => {
    const [first] = translatedLanguages;
    const drift = compareWithBaseline({
      ru: [],
      kk: [],
      [first]: ["notARealKey"],
    } as MissingTranslationBaseline);
    const entry = drift.find((d) => d.language === first)!;
    expect(entry.stale).toEqual(["notARealKey"]);
    expect(entry.newlyMissing.length).toBeGreaterThan(0);
  });
});
