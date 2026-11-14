import { describe, expect, it } from "vitest";
import {
  deriveLearnerStatusState,
  learnerRecoveryState,
  NO_MATCH_AFTER_MS,
} from "./learner-status";

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

describe("deriveLearnerStatusState (request status enum, not brief status)", () => {
  const now = new Date("2026-11-06T12:00:00Z");
  const createdRecently = new Date(now.getTime() - 60 * 60 * 1000);
  const accepted = new Date("2026-11-06T10:00:00Z");
  const slot = new Date("2026-11-08T10:00:00Z");
  const readyMatch = {
    status: "proposed",
    humanDecision: "accepted",
    mentorAcceptedAt: accepted,
    learnerAcceptedAt: null,
    proposedSlotAt: slot,
  };

  const derive = (
    requestStatus: string,
    match?: Parameters<typeof deriveLearnerStatusState>[0]["match"],
    requestCreatedAt = createdRecently,
  ) =>
    deriveLearnerStatusState({ requestStatus, requestCreatedAt, match, now })
      .state;

  it("shows waiting for a fresh eligible or matching request", () => {
    expect(derive("eligible")).toBe("waiting");
    expect(derive("matching")).toBe("waiting");
  });

  it("shows the honest no-match state after 24 hours, but only while the request is open", () => {
    const old = new Date(now.getTime() - NO_MATCH_AFTER_MS);
    expect(derive("eligible", undefined, old)).toBe("no_match");
    expect(derive("matching", undefined, old)).toBe("no_match");
    expect(derive("no_match")).toBe("no_match");
    expect(derive("submitted", undefined, old)).toBe("waiting");
  });

  it("shows matched only when the operator accepted and the mentor proposed a time", () => {
    expect(derive("matched", readyMatch)).toBe("matched");
    expect(derive("matched", { ...readyMatch, humanDecision: "pending" })).toBe(
      "waiting",
    );
    expect(derive("matched", { ...readyMatch, mentorAcceptedAt: null })).toBe(
      "waiting",
    );
    expect(derive("matched", { ...readyMatch, proposedSlotAt: null })).toBe(
      "waiting",
    );
    expect(derive("matching", readyMatch)).toBe("waiting");
  });

  it("shows confirmed only when both sides accepted", () => {
    const confirmed = { ...readyMatch, status: "accepted", learnerAcceptedAt: now };
    expect(derive("session_scheduled", confirmed)).toBe("confirmed");
    expect(
      derive("session_scheduled", { ...confirmed, learnerAcceptedAt: null }),
    ).toBe("waiting");
  });

  it("keeps each recovery state distinct", () => {
    expect(
      derive("matching", {
        ...readyMatch,
        status: "declined",
        humanDecision: "rejected",
      }),
    ).toBe("time_declined");
    expect(derive("matched", { ...readyMatch, status: "withdrawn" })).toBe(
      "mentor_withdrew",
    );
    expect(
      derive("session_scheduled", {
        ...readyMatch,
        status: "accepted",
        learnerAcceptedAt: now,
        sessionCompletionState: "cancelled",
      }),
    ).toBe("session_cancelled");
  });
});
