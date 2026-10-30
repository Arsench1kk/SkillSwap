import { describe, expect, it } from "vitest";
import { addCalendarDays, contactIsValid, validDateOnly } from "./learner-request-submission";

describe("learner request input helpers", () => {
  it("validates real calendar dates and adds calendar days", () => {
    expect(validDateOnly("2028-02-29")).toBe(true);
    expect(validDateOnly("2027-02-29")).toBe(false);
    expect(addCalendarDays("2026-12-29", 14)).toBe("2027-01-12");
  });

  it("validates separated Telegram and phone contact values", () => {
    expect(contactIsValid("telegram", "@student_123")).toBe(true);
    expect(contactIsValid("telegram", "@ab")).toBe(false);
    expect(contactIsValid("phone", "+7 777 123 4567")).toBe(true);
    expect(contactIsValid("phone", "12345")).toBe(false);
  });
});
