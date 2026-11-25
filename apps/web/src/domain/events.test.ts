import { describe, expect, it } from "vitest";
import {
  containsContactData,
  validateEventContext,
  validateEventInput,
} from "./events";

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

describe("server event context validation", () => {
  const validContext = {
    participantId: "L-abcdef0123",
    dataOrigin: "rehearsal" as const,
  };

  it.each(["L-abcdef0123", "M-abcdef0123", "O-abcdef0123"])(
    "accepts anonymised subject %s without account PII",
    (participantId) => {
      expect(validateEventContext({ ...validContext, participantId })).toEqual({
        ...validContext,
        participantId,
      });
    },
  );

  it.each(["account-id", "person@example.test", "@contact", "L-short"])(
    "rejects a non-participant identity %s",
    (participantId) => {
      expect(() =>
        validateEventContext({ ...validContext, participantId }),
      ).toThrow();
    },
  );

  it("rejects extra identity/PII fields instead of persisting them", () => {
    expect(() =>
      validateEventContext({
        ...validContext,
        email: "synthetic@example.test",
      } as never),
    ).toThrow();
    expect(() =>
      validateEventContext({
        ...validContext,
        role: "operator",
      } as never),
    ).toThrow();
  });

  it("validates server origin and requires an operator actor identity", () => {
    expect(() =>
      validateEventContext({ ...validContext, dataOrigin: "unknown" } as never),
    ).toThrow();
    expect(() =>
      validateEventContext({
        ...validContext,
        actorParticipantId: "L-abcdef0123",
      }),
    ).toThrow();
    expect(
      validateEventContext({
        ...validContext,
        actorParticipantId: "O-abcdef0123",
      }).actorParticipantId,
    ).toBe("O-abcdef0123");
  });

  it("preserves the loaded template version and rejects a blank version", () => {
    expect(
      validateEventContext({ ...validContext, templateVersion: " brief-v1 " })
        .templateVersion,
    ).toBe(" brief-v1 ");
    expect(() =>
      validateEventContext({ ...validContext, templateVersion: " " }),
    ).toThrow();
  });
});
