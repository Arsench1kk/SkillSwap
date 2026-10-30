import { describe, expect, it } from "vitest";
import { opsReplyMessage } from "./ops-response";

describe("optional operations response time", () => {
  it("shows the configured number of hours", () => {
    expect(opsReplyMessage("6")).toBe(
      "We will tell you the outcome within 6 hours.",
    );
  });

  it("omits the sentence when unset or invalid", () => {
    expect(opsReplyMessage("")).toBeNull();
    expect(opsReplyMessage("soon")).toBeNull();
  });
});
