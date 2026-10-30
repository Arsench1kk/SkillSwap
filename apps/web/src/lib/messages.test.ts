import { describe, expect, it } from "vitest";
import { messages, t } from "../../messages/en";

describe("English message catalog", () => {
  it("provides the product name through a typed accessor", () => {
    expect(t("brand")).toBe("SkillSwap");
    expect(Object.values(messages).every((message) => message.length > 0)).toBe(
      true,
    );
  });
});
