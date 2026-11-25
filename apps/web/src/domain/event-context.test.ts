import { afterEach, describe, expect, it, vi } from "vitest";
import { currentDataOrigin } from "./event-context";

describe("server event origin", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(["real_pilot", "constructed", "rehearsal"])(
    "uses the configured production cohort %s",
    (origin) => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("SKILLSWAP_DATA_ORIGIN", origin);
      expect(currentDataOrigin()).toBe(origin);
    },
  );

  it.each([undefined, "real", "", "REAL_PILOT"])(
    "rejects a missing/invalid production origin %s",
    (origin) => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("SKILLSWAP_DATA_ORIGIN", origin);
      expect(() => currentDataOrigin()).toThrow("SKILLSWAP_DATA_ORIGIN");
    },
  );

  it("retains local rehearsal fallback and reads config on each call", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("SKILLSWAP_DATA_ORIGIN", undefined);
    expect(currentDataOrigin()).toBe("rehearsal");
    vi.stubEnv("SKILLSWAP_DATA_ORIGIN", "constructed");
    expect(currentDataOrigin()).toBe("constructed");
  });
});
