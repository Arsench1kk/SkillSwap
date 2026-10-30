import { describe, expect, it } from "vitest";
import { transitionBriefState, transitionRequestState } from "./state-machines";

describe("request state machine", () => {
  it("allows the documented happy path and recovery to matching", () => {
    expect(transitionRequestState("draft", "submitted").ok).toBe(true);
    expect(transitionRequestState("submitted", "eligible").ok).toBe(true);
    expect(transitionRequestState("submitted", "ineligible").ok).toBe(true);
    expect(transitionRequestState("matched", "matching").ok).toBe(true);
    expect(transitionRequestState("session_scheduled", "completed").ok).toBe(
      true,
    );
  });

  it("rejects illegal and terminal transitions", () => {
    expect(transitionRequestState("draft", "completed")).toEqual({
      ok: false,
      from: "draft",
      to: "completed",
      error: "illegal_transition",
    });
    expect(transitionRequestState("no_match", "matching").ok).toBe(false);
    expect(transitionRequestState("no_match", "cancelled").ok).toBe(true);
  });
});

describe("mentor brief state machine", () => {
  it("allows mentor response and learner confirmation", () => {
    expect(transitionBriefState("invited", "viewed").ok).toBe(true);
    expect(transitionBriefState("viewed", "accepted").ok).toBe(true);
    expect(transitionBriefState("slot_proposed", "confirmed").ok).toBe(true);
  });

  it("allows a mentor to reverse a decline or withdraw before confirmation", () => {
    expect(transitionBriefState("declined", "slot_proposed").ok).toBe(true);
    expect(transitionBriefState("slot_proposed", "withdrawn").ok).toBe(true);
    expect(transitionBriefState("confirmed", "slot_proposed").ok).toBe(false);
    expect(transitionBriefState("confirmed", "withdrawn").ok).toBe(false);
  });
});
