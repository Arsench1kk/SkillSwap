/**
 * Translation coverage report.
 *
 *   npm run i18n:report            print coverage per key group
 *   npm run i18n:report -- --write accept the current gaps as the new baseline
 *
 * Only write the baseline on purpose: the catalog-coverage test fails when a key
 * is missing from a translation without being listed there.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  buildBaseline,
  catalogProblems,
  coverageByGroup,
  missingKeys,
  totalKeys,
  translatedLanguages,
} from "./catalog-coverage";

const baselinePath = fileURLToPath(
  new URL("./missing-translations.baseline.json", import.meta.url),
);

const rows = coverageByGroup().map((group) => ({
  group: group.group,
  keys: group.total,
  ...Object.fromEntries(
    translatedLanguages.map((language) => [
      `${language} missing`,
      group.missing[language],
    ]),
  ),
}));

console.log(`English keys: ${totalKeys}`);
for (const language of translatedLanguages) {
  const missing = missingKeys(language).length;
  console.log(
    `${language}: ${totalKeys - missing} translated, ${missing} fall back to English`,
  );
}
console.table(rows);

const problems = catalogProblems();
if (problems.length > 0) {
  console.error("Broken translations:");
  console.table(problems);
  process.exitCode = 1;
}

if (process.argv.includes("--write")) {
  writeFileSync(baselinePath, `${JSON.stringify(buildBaseline(), null, 2)}\n`);
  console.log(`Baseline written to ${baselinePath}`);
}
