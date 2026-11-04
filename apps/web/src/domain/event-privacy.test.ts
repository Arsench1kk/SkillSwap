import { describe, expect, it, vi } from "vitest";
import type { DatabaseExecutor } from "@/db/types";
import { containsContactData, recordEvent, validateEventInput } from "./events";

const contacts = [
  "synthetic@example.test",
  "+7 777 123 45 67",
  "(@synthetic_handle)",
  "https://t.me/synthetic_handle",
  "telegram.me/synthetic_handle",
  "https://wa.me/77771234567",
];

describe("event metadata privacy boundary", () => {
  it.each(contacts)("recognises a direct contact reference: %s", (contact) => {
    expect(containsContactData(contact)).toBe(true);
  });

  for (const field of ["note", "reasonCode", "sourceChannel"] as const) {
    it.each(contacts)(
      `rejects contact references in ${field}: %s`,
      (contact) => {
        expect(() =>
          validateEventInput({
            eventName: "request_submitted",
            [field]: contact,
          }),
        ).toThrow();
      },
    );
  }

  it("rejects a phone number disguised as an otherwise valid source code", () => {
    expect(() =>
      validateEventInput({
        eventName: "request_submitted",
        sourceChannel: "77771234567",
      }),
    ).toThrow();
  });

  it.each([
    "web",
    "rehearsal_seed",
    "deadline_outside_14_days",
    "scheduling",
    "privacy_contact",
    "not_my_skill",
  ])("preserves non-identifying metadata codes: %s", (code) => {
    expect(
      validateEventInput({
        eventName: "request_submitted",
        reasonCode: code,
        sourceChannel: code,
      }),
    ).toMatchObject({ reasonCode: code, sourceChannel: code });
  });

  it("preserves absent metadata and does not replace missing values with zero", () => {
    expect(
      validateEventInput({
        eventName: "request_submitted",
        note: null,
        reasonCode: null,
        sourceChannel: null,
        value: null,
      }),
    ).toMatchObject({
      note: null,
      reasonCode: null,
      sourceChannel: null,
      value: null,
    });
  });

  it("rejects private metadata before any database access", async () => {
    const select = vi.fn();
    const insert = vi.fn();
    const database = { select, insert } as unknown as DatabaseExecutor;
    await expect(
      recordEvent(
        database,
        { participantId: "L-abcdef0123", dataOrigin: "rehearsal" },
        {
          eventName: "eligibility_checked",
          reasonCode: "synthetic@example.test",
        },
      ),
    ).rejects.toThrow();
    expect(select).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });
});
