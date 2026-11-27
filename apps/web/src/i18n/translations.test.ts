import { describe, expect, it } from "vitest";
import { messages, type MessageKey } from "@/messages/en";
import { translations } from "./translations";

// The learner request flow (L1-L3 and the expired link) must stay fully
// Russian. Adding an English request* key without a ru string fails here.
const requestKeys = (Object.keys(messages) as MessageKey[]).filter(
  (key) => key.startsWith("request") || key === "expiredLinkText",
);

describe("ru catalog for the learner request flow", () => {
  it("covers a non-trivial set of request keys", () => {
    expect(requestKeys.length).toBeGreaterThan(40);
    expect(requestKeys).toContain("expiredLinkText");
  });

  it("has a non-empty ru string for every request key", () => {
    const ru: Partial<Record<MessageKey, string>> = translations.ru;
    const missing = requestKeys.filter((key) => !ru[key]?.trim());
    expect(missing).toEqual([]);
  });
});
