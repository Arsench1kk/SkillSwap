import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Release-wide accessibility smoke at 360 px: automated WCAG 2.1 A/AA rules
 * (axe), tap-target size of interactive controls, horizontal overflow and a
 * visible keyboard focus. Automated checks find a subset of issues; manual
 * keyboard/screen-reader review is still part of the release checklist.
 *
 * Token routes use an invalid token, so they render their public
 * invalid/expired state without fixtures.
 */
const routes = [
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/privacy",
  "/request",
  "/mentor/join",
  "/dev/kit",
  "/brief/invalid-token",
  "/request/invalid-token",
  "/session/invalid-token",
  "/rate/invalid-token",
  "/report/invalid-token",
];

const MIN_TARGET = 44;

/**
 * Known issues in files owned by other teams, reported in handoff D6-H004.
 * Only the listed rule/target is tolerated on the listed route; anything new
 * still fails. Remove an entry in the owner's fix PR.
 */
const knownIssues: Record<string, { axe?: string[]; targets?: string[] }> = {
  // D2 app/page.tsx: aria-label on the wordmark hides the visible "s" mark.
  "/": { axe: ["label-content-name-mismatch"] },
  // D1 components/auth-concept.tsx: same wordmark pattern.
  "/login": { axe: ["label-content-name-mismatch"] },
  "/signup": { axe: ["label-content-name-mismatch"] },
  "/forgot-password": { axe: ["label-content-name-mismatch"] },
  "/reset-password": { axe: ["label-content-name-mismatch"] },
  // D2 app/request/request-form.tsx: calendar button is 40×40.
  "/request": { targets: ["Open date picker"] },
};

async function undersizedTargets(page: Page) {
  return page.evaluate((min) => {
    const selector =
      'button, [role="button"], input:not([type="hidden"]), select, textarea, summary, a.ss-button, [role="radio"], [role="checkbox"], [role="tab"]';
    return [...document.querySelectorAll<HTMLElement>(selector)]
      .filter((element) => {
        const style = getComputedStyle(element);
        if (style.visibility === "hidden" || style.display === "none") {
          return false;
        }
        const box = element.getBoundingClientRect();
        if (box.width === 0 && box.height === 0) return false;
        // A small control is fine when an associated label enlarges the target.
        const labels = [
          element.closest("label"),
          ...(("labels" in element && (element as HTMLInputElement).labels) ||
            []),
        ].filter((label): label is HTMLLabelElement => Boolean(label));
        const rects = [box, ...labels.map((l) => l.getBoundingClientRect())];
        const left = Math.min(...rects.map((r) => r.left));
        const right = Math.max(...rects.map((r) => r.right));
        const top = Math.min(...rects.map((r) => r.top));
        const bottom = Math.max(...rects.map((r) => r.bottom));
        return right - left < min || bottom - top < min;
      })
      .map((element) => {
        const box = element.getBoundingClientRect();
        const name =
          element.getAttribute("aria-label") ??
          element.textContent?.trim().slice(0, 40) ??
          "";
        return `${element.tagName.toLowerCase()} "${name}" ${Math.round(box.width)}×${Math.round(box.height)}`;
      });
  }, MIN_TARGET);
}

test.describe("accessibility at 360 px", () => {
  test.use({ viewport: { width: 360, height: 800 } });

  for (const route of routes) {
    test(`${route} passes automated WCAG A/AA checks`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      const tolerated = knownIssues[route]?.axe ?? [];
      const summary = results.violations
        .filter((violation) => !tolerated.includes(violation.id))
        .map(
          (violation) =>
            `${violation.id} (${violation.impact}): ${violation.nodes
              .slice(0, 3)
              .map((node) => node.target.join(" "))
              .join(" | ")}`,
        );
      expect(summary, "axe violations").toEqual([]);
    });

    test(`${route} fits 360 px with ${MIN_TARGET}px tap targets`, async ({
      page,
    }) => {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(360);
      const tolerated = knownIssues[route]?.targets ?? [];
      const undersized = (await undersizedTargets(page)).filter(
        (entry) => !tolerated.some((name) => entry.includes(`"${name}"`)),
      );
      expect(undersized, "undersized targets").toEqual([]);
    });
  }
});

test("keyboard focus is visible on the first controls of the home page", async ({
  page,
}) => {
  await page.goto("/");
  for (let step = 0; step < 4; step += 1) {
    await page.keyboard.press("Tab");
    const visible = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      if (!element || element === document.body) return false;
      const style = getComputedStyle(element);
      const outline =
        style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0;
      const ring = style.boxShadow !== "none";
      return outline || ring;
    });
    expect(visible, `focus ring on tab stop ${step + 1}`).toBe(true);
  }
});

test("loaded fonts cover Kazakh and Russian letters", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("group", { name: "Language" })
    .getByRole("button", { name: "KK" })
    .click();
  await expect(page.locator("html")).toHaveAttribute("lang", "kk");
  await page.evaluate(() => document.fonts.ready);
  const uncovered = await page.evaluate(() => {
    const letters = "әғқңөұүһіжщ";
    const ranges = [...document.fonts]
      .filter((face) => face.status === "loaded")
      .flatMap((face) => face.unicodeRange.split(","))
      .map((range) => {
        const [start, end] = range.trim().replace("U+", "").split("-");
        const from = parseInt(start, 16);
        return [from, end ? parseInt(end, 16) : from];
      });
    return [...letters].filter((letter) => {
      const code = letter.codePointAt(0)!;
      return !ranges.some(([from, to]) => code >= from && code <= to);
    });
  });
  expect(uncovered).toEqual([]);
});
