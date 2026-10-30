import { describe, expect, it } from "vitest";
import { containsContactData, validateEventInput } from "./events";

describe("event validation", () => {
  it("accepts a data-dictionary event with nullable experiment", () => {
    expect(
      validateEventInput({
        eventName: "request_submitted",
        experiment: null,
      }).eventName,
    ).toBe("request_submitted");
  });

  it.each([
    "request_cancelled",
    "request_updated",
    "match_declined",
    "session_cancelled",
    "mentor_join_submitted",
  ] as const)("accepts the approved public-flow event %s", (eventName) => {
    expect(validateEventInput({ eventName }).eventName).toBe(eventName);
  });

  it.each([
    "write to person@example.com",
    "call +7 777 123 45 67",
    "telegram @sample_handle",
  ])("rejects contact data in notes: %s", (note) => {
    expect(containsContactData(note)).toBe(true);
    expect(() =>
      validateEventInput({ eventName: "request_submitted", note }),
    ).toThrow();
  });

  it("requires reason and brief type where the dictionary says so", () => {
    expect(() => validateEventInput({ eventName: "no_show" })).toThrow();
    expect(() => validateEventInput({ eventName: "brief_sent" })).toThrow();
  });

  it("does not accept server-assigned fields from event input", () => {
    expect(() =>
      validateEventInput({
        eventName: "request_submitted",
        dataOrigin: "real_pilot",
      } as never),
    ).toThrow();
  });
});
