import { describe, expect, it } from "vitest";
import { classifyRatingState, isRatingWindowOpen } from "./rating-page";

describe("rating window", () => {
  const endsAt = new Date("2026-10-20T10:00:00.000Z");

  it("is open through the two-hour cutoff", () => {
    expect(
      isRatingWindowOpen(endsAt, new Date("2026-10-20T12:00:00.000Z")),
    ).toBe(true);
  });

  it("closes after the two-hour cutoff", () => {
    expect(
      isRatingWindowOpen(endsAt, new Date("2026-10-20T12:00:00.001Z")),
    ).toBe(false);
  });

  it("keeps ratings open when the session end is not recorded", () => {
    expect(isRatingWindowOpen(null, new Date("2026-10-20T12:00:00.001Z"))).toBe(
      true,
    );
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
