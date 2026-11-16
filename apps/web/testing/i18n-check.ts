/**
 * npm run i18n:check                     # report; fail only on broken placeholders
 * npm run i18n:check -- --require ru,kk  # also fail on missing production keys
 * npm run i18n:check -- --worksheet ru   # CSV of missing keys for a translator
 *
 * Pass --require only once R09 has approved which locales are mandatory.
 */
import {
  coverageReport,
  translatedLocales,
  worksheetCsv,
} from "../src/i18n/coverage";
import { isLocale } from "../src/i18n/config";

function argValue(flag: string) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

const worksheet = argValue("--worksheet");
if (worksheet) {
  if (!isLocale(worksheet) || worksheet === "en") {
    console.error(`Unknown translation locale: ${worksheet}`);
    process.exit(2);
  }
  process.stdout.write(worksheetCsv(worksheet));
  process.exit(0);
}

const required = (argValue("--require") ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

let failed = false;
for (const locale of translatedLocales) {
  const report = coverageReport(locale);
  const { dev, untranslated, workspace, production } = report.missing;
  console.log(
    `[i18n] ${locale}: ${report.total} keys; missing production ${production.length}, ` +
      `workspace ${workspace.length}, dev ${dev.length}, untranslated ${untranslated.length}`,
  );
  if (report.placeholderMismatches.length > 0) {
    failed = true;
    console.error(
      `[i18n] ${locale}: placeholder mismatch in ${report.placeholderMismatches.join(", ")}`,
    );
  }
  if (required.includes(locale) && production.length > 0) {
    failed = true;
    console.error(
      `[i18n] ${locale}: required locale is missing ${production.join(", ")}`,
    );
  }
}
if (required.length === 0) {
  console.log(
    "[i18n] Report only: required locales are not approved yet (R09).",
  );
}
process.exit(failed ? 1 : 0);
