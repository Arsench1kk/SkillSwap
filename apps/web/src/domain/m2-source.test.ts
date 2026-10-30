import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const briefPage = readFileSync(
  new URL("../../app/brief/[token]/page.tsx", import.meta.url),
  "utf8",
);

describe("M2 source contract", () => {
  it("links the report path from the M2 brief after the no-show rule", () => {
    const noShowIndex = briefPage.indexOf('className="brief-no-show"');
    const reportLinkIndex = briefPage.indexOf(
      "/report/${encodeURIComponent(brief.token)}",
      noShowIndex,
    );
    expect(noShowIndex).toBeGreaterThanOrEqual(0);
    expect(reportLinkIndex).toBeGreaterThan(noShowIndex);
    expect(briefPage.slice(noShowIndex, reportLinkIndex)).toContain(
      "briefNoShowText",
    );
  });
});
