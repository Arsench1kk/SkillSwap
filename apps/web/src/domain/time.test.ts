import { describe, expect, it } from "vitest";
import {
  formatKazakhstanTime,
  kazakhstanLocalTimeToUtc,
  toKazakhstanDateTimeInput,
  toUtc,
} from "./time";

describe("Kazakhstan time helpers", () => {
  it("formats the same UTC instant in Almaty time with a localized zone label", () => {
    const instant = new Date("2026-10-20T09:00:00.000Z");
    expect(formatKazakhstanTime(instant, "en")).toMatch(/14:00.*Almaty time/);
    expect(formatKazakhstanTime(instant, "ru")).toMatch(/время Алматы/);
    expect(formatKazakhstanTime(instant, "kk")).toMatch(/Алматы уақыты/);
  });

  it("keeps the instant in UTC and rejects invalid dates", () => {
    const instant = new Date("2026-10-20T09:00:00.000Z");
    expect(toUtc(instant).toISOString()).toBe(instant.toISOString());
    expect(() => toUtc(new Date("invalid"))).toThrow("Invalid date");
  });

  it("converts Almaty wall-clock values to UTC", () => {
    expect(kazakhstanLocalTimeToUtc("2026-10-22T18:00")?.toISOString()).toBe(
      "2026-10-22T13:00:00.000Z",
    );
    expect(kazakhstanLocalTimeToUtc("not-a-date")).toBeNull();
    expect(kazakhstanLocalTimeToUtc("2026-02-31T18:00")).toBeNull();
    expect(
      toKazakhstanDateTimeInput(new Date("2026-10-22T13:00:00.000Z")),
    ).toBe("2026-10-22T18:00");
  });
});
