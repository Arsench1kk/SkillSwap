import { describe, expect, it } from "vitest";
import { learnerRecoveryState } from "./learner-status";

describe("learner recovery states", () => {
  it("distinguishes a learner-declined proposed time", () => {
    expect(learnerRecoveryState("matching", "declined", "rejected")).toBe(
      "time_declined",
    );
  });

  it("distinguishes a mentor withdrawal while the request is still matched", () => {
    expect(learnerRecoveryState("matched", "withdrawn", "accepted")).toBe(
      "mentor_withdrew",
    );
  });

  it("does not mistake an unanswered mentor decline for learner-declined time", () => {
    expect(learnerRecoveryState("matching", "declined", "pending")).toBe(
      null,
    );
  });

  it("distinguishes a cancelled session from a pre-confirmation mentor withdrawal", () => {
    expect(
      learnerRecoveryState(
        "session_scheduled",
        "withdrawn",
        "accepted",
        "cancelled",
      ),
    ).toBe("session_cancelled");
  });
});
