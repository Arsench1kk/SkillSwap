import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Automated WCAG 2.1 A/AA scan of public screens at the 360 px design width.
 * axe catches only part of what DESIGN.md and AGENTS.md require; keyboard,
 * focus order and meaning still need the manual checks in each screen's PR.
 *
 * Screens that need fixtures or a session are covered by their owners' specs.
 * Add a screen here once it renders without them.
 */
const screens = [
  { id: "E0", name: "entry", path: "/" },
  { id: "L1", name: "request form", path: "/request" },
  { id: "M1", name: "mentor join", path: "/mentor/join" },
  { id: "X1", name: "invalid link", path: "/session/not-a-valid-token" },
  { id: "X3", name: "privacy", path: "/privacy" },
  { id: "AUTH", name: "log in", path: "/login" },
  { id: "AUTH", name: "sign up", path: "/signup" },
  { id: "AUTH", name: "forgot password", path: "/forgot-password" },
  { id: "AUTH", name: "reset password", path: "/reset-password" },
] as const;

const wcagTags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

/**
 * Violations already reported to the file owner. Each entry is a debt, not an
 * exemption: it matches one rule on selectors containing `target`, and the
 * test notes when it no longer occurs so the entry can be deleted. Anything
 * not listed here fails the test.
 */
const knownIssues = [
  {
    rule: "label-content-name-mismatch",
    target: "wordmark",
    owner: "D2 app/page.tsx, D1 components/auth-concept.tsx",
    note: "aria-label on the home wordmark link overrides its visible text (WCAG 2.5.3). Removing the redundant aria-label fixes it.",
  },
] as const;

type Violation = {
  rule: string;
  impact: string | null | undefined;
  help: string;
  targets: string[];
};

function isKnown(violation: Violation) {
  return knownIssues.some(
    (issue) =>
      issue.rule === violation.rule &&
      violation.targets.every((target) => target.includes(issue.target)),
  );
}

async function scan(page: Page): Promise<Violation[]> {
  const results = await new AxeBuilder({ page }).withTags(wcagTags).analyze();
  // Short, readable failure output: rule, impact and the offending selectors.
  return results.violations.map((violation) => ({
    rule: violation.id,
    impact: violation.impact,
    help: violation.help,
    targets: violation.nodes.map((node) => node.target.join(" ")),
  }));
}

test.describe("accessibility at phone width", () => {
  test.use({ viewport: { width: 360, height: 780 } });

  for (const screen of screens) {
    test(`${screen.id} ${screen.name} has no WCAG A/AA violations`, async ({
      page,
    }) => {
      await page.goto(screen.path);
      await expect(page.locator("main, [role=main]").first()).toBeVisible();
      const violations = await scan(page);
      for (const violation of violations.filter(isKnown)) {
        test.info().annotations.push({
          type: "known accessibility issue",
          description: `${violation.rule} on ${violation.targets.join(", ")}`,
        });
      }
      expect(violations.filter((violation) => !isKnown(violation))).toEqual([]);
    });
  }

  test("known issues still occur, otherwise remove them from the list", async ({
    page,
  }) => {
    const seen = new Set<string>();
    for (const screen of screens) {
      await page.goto(screen.path);
      for (const violation of await scan(page)) {
        if (isKnown(violation)) seen.add(violation.rule);
      }
    }
    const resolved = knownIssues.filter((issue) => !seen.has(issue.rule));
    // A fixed issue is good news, so this only annotates instead of failing
    // the owner's fix PR; D6 deletes the entry afterwards.
    for (const issue of resolved) {
      test.info().annotations.push({
        type: "resolved accessibility issue",
        description: `${issue.rule} (${issue.owner}) no longer occurs; delete it from knownIssues.`,
      });
      console.warn(`[a11y] resolved, remove from knownIssues: ${issue.rule}`);
    }
  });
});
