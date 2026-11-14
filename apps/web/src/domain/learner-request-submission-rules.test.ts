import { describe, expect, it } from "vitest";
import {
  contactIsValid,
  deadlineIsEligible,
  learnerRequestInputSchema,
} from "./learner-request-submission-rules";

const valid = {
  category: "STEM",
  task: "My chart does not update.",
  tried: "Refreshed the data.",
  deadline: "2026-11-10",
  windows: [
    { start: "2026-11-09T18:00", end: "2026-11-09T19:00" },
    { start: "2026-11-10T18:00", end: "2026-11-10T19:00" },
  ],
  giveBack: "",
  contactType: "telegram",
  contact: "@student_123",
  consent: true,
} as const;

describe("learner request input schema", () => {
  it("accepts a complete request, with giveBack optional but present", () => {
    expect(learnerRequestInputSchema.safeParse(valid).success).toBe(true);
  });

  it("requires two or three time windows", () => {
    expect(
      learnerRequestInputSchema.safeParse({
        ...valid,
        windows: valid.windows.slice(0, 1),
      }).success,
    ).toBe(false);
    expect(
      learnerRequestInputSchema.safeParse({
        ...valid,
        windows: [...valid.windows, ...valid.windows],
      }).success,
    ).toBe(false);
    expect(
      learnerRequestInputSchema.safeParse({
        ...valid,
        windows: [...valid.windows, valid.windows[0]],
      }).success,
    ).toBe(true);
  });

  it("requires consent to be exactly true", () => {
    expect(
      learnerRequestInputSchema.safeParse({ ...valid, consent: false }).success,
    ).toBe(false);
  });

  it("rejects fields the form does not have, such as a participant id", () => {
    expect(
      learnerRequestInputSchema.safeParse({ ...valid, participantId: "L-1" })
        .success,
    ).toBe(false);
  });

  it("trims text and rejects whitespace-only answers", () => {
    expect(
      learnerRequestInputSchema.safeParse({ ...valid, task: "   " }).success,
    ).toBe(false);
    expect(
      learnerRequestInputSchema.safeParse({ ...valid, tried: "" }).success,
    ).toBe(false);
  });
});

describe("deadline eligibility (14 days, Kazakhstan date)", () => {
  // 2026-11-06 21:00 UTC is already 2026-11-07 02:00 in Almaty.
  const now = new Date("2026-11-06T21:00:00Z");

  it("uses the Kazakhstan calendar date, not the UTC date", () => {
    expect(deadlineIsEligible("2026-11-07", now)).toBe(true);
    expect(deadlineIsEligible("2026-11-06", now)).toBe(false);
  });

  it("accepts the 14th day and rejects the 15th", () => {
    expect(deadlineIsEligible("2026-11-21", now)).toBe(true);
    expect(deadlineIsEligible("2026-11-22", now)).toBe(false);
  });

  it("rejects dates that do not exist", () => {
    expect(deadlineIsEligible("2026-02-30", now)).toBe(false);
  });
});

describe("contact format", () => {
  it("accepts Telegram usernames with or without @ and phone numbers", () => {
    expect(contactIsValid("telegram", "student_1")).toBe(true);
    expect(contactIsValid("telegram", "@student_1")).toBe(true);
    expect(contactIsValid("phone", "8 (777) 123-45-67")).toBe(true);
  });

  it("rejects malformed values and a phone typed as Telegram", () => {
    expect(contactIsValid("telegram", "+77771234567")).toBe(false);
    expect(contactIsValid("telegram", "has space")).toBe(false);
    expect(contactIsValid("phone", "@student_1")).toBe(false);
  });
});
