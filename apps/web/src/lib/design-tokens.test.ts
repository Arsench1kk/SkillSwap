import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
const prototypeCss = readFileSync(
  new URL("../../app/prototype/prototype.module.css", import.meta.url),
  "utf8",
);
const tokens = Object.fromEntries([...css.matchAll(/--([\w-]+):\s*(#[\da-fA-F]{6})\s*;/g)].map((match) => [match[1], match[2]]));
const definedSpacing = new Set(
  [...css.matchAll(/--space-(\d+):/g)].map((match) => `--space-${match[1]}`),
);
const usedSpacing =
  [...css, ...prototypeCss]
    .join("")
    .match(/var\((--space-\d+)\)/g)
    ?.map((match) => match.slice(4, -1)) ?? [];

function luminance(hex: string) {
  const channels = hex.slice(1).match(/.{2}/g)!.map((part) => parseInt(part, 16) / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(foreground: string, background: string) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

describe("DESIGN.md token contrast pairs", () => {
  it.each([
    ["ink", "bg", 4.5],
    ["ink-muted", "bg", 4.5],
    ["line-strong", "bg", 3],
    ["accent", "bg", 4.5],
    ["accent-ink", "accent", 4.5],
    ["accent", "accent-tint", 4.5],
    ["warn", "bg", 4.5],
    ["danger", "bg", 4.5],
  ])("%s on %s meets its contrast threshold", (foreground, background, minimum) => {
    expect(tokens[foreground]).toBeDefined();
    expect(tokens[background]).toBeDefined();
    expect(contrast(tokens[foreground], tokens[background])).toBeGreaterThanOrEqual(minimum);
  });
});

it("defines every spacing token used by the app shell and workspace", () => {
  expect(
    [...new Set(usedSpacing)].filter((token) => !definedSpacing.has(token)),
  ).toEqual([]);
});
