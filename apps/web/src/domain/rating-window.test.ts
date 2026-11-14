import { describe, expect, it } from "vitest";
import { classifyRatingState, isRatingWindowOpen } from "./rating-page";

describe("rating window", () => {
  const endsAt = new Date("2026-10-20T10:00:00.000Z");
  const completed = { endsAt, completionState: "completed" as const };

  it.each([
    ["2026-10-20T09:59:59.999Z", false],
    ["2026-10-20T10:00:00.000Z", true],
    ["2026-10-20T11:59:59.999Z", true],
    ["2026-10-20T12:00:00.000Z", true],
    ["2026-10-20T12:00:00.001Z", false],
  ])("checks the completed session boundary at %s", (time, expected) => {
    expect(isRatingWindowOpen(completed, new Date(time))).toBe(expected);
  });

  it.each(["scheduled", "started", "cancelled", "no_show"] as const)(
    "rejects %s even when its end time is inside the window",
    (completionState) => {
      expect(
        isRatingWindowOpen(
          { endsAt, completionState },
          new Date("2026-10-20T11:00:00Z"),
        ),
      ).toBe(false);
    },
  );

  it("rejects completed sessions without a recorded end", () => {
    expect(
      isRatingWindowOpen(
        { endsAt: null, completionState: "completed" },
        new Date("2026-10-20T11:00:00Z"),
      ),
    ).toBe(false);
  });

  it("rejects invalid dates", () => {
    expect(isRatingWindowOpen({ ...completed, endsAt: new Date(NaN) })).toBe(
      false,
    );
    expect(isRatingWindowOpen(completed, new Date(NaN))).toBe(false);
  });
});

describe("rating state", () => {
  it("distinguishes untouched, partial and complete feedback", () => {
    expect(
      classifyRatingState(
        { unblocked: null, oneLineOutcome: null, trust: null },
        true,
      ),
    ).toBe("form");
    expect(
      classifyRatingState(
        { unblocked: 4, oneLineOutcome: null, trust: null },
        true,
      ),
    ).toBe("partial");
    expect(
      classifyRatingState(
        { unblocked: 4, oneLineOutcome: "I can fix it.", trust: 5 },
        false,
      ),
    ).toBe("submitted");
  });

  it("distinguishes skipped and partial feedback after expiry", () => {
    expect(
      classifyRatingState(
        { unblocked: null, oneLineOutcome: null, trust: null },
        false,
      ),
    ).toBe("skipped");
    expect(
      classifyRatingState(
        { unblocked: 3, oneLineOutcome: null, trust: null },
        false,
      ),
    ).toBe("partial_expired");
  });
});
