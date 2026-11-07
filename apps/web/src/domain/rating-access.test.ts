import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  update: vi.fn(),
  recordEvent: vi.fn(),
}));

vi.mock("@/db/client", () => {
  const query = {
    from: () => query,
    innerJoin: () => query,
    where: () => query,
    for: () => query,
    limit: async () => mocks.rows,
  };
  const db = {
    select: () => query,
    update: mocks.update,
    transaction: async (run: (tx: unknown) => unknown) => run(db),
  };
  return { db };
});
vi.mock("@/domain/private-links", () => ({
  verifyPrivateLink: async () => ({
    status: "valid",
    purpose: "rating",
    subjectType: "feedback",
    subjectId: "feedback-1",
  }),
}));
vi.mock("@/domain/rate-limit", () => ({
  allowRateLimitedAttempt: async () => true,
}));
vi.mock("@/domain/events", () => ({
  containsContactData: () => false,
  recordEvent: mocks.recordEvent,
}));
vi.mock("@/domain/mentor-brief-page", () => ({
  currentDataOrigin: () => "rehearsal",
}));

import { getRatingPage } from "./rating-page";
import { POST } from "../../app/api/rating/route";

function submit() {
  return POST(
    new Request("http://localhost/api/rating", {
      method: "POST",
      body: JSON.stringify({ token: "a".repeat(43), unblocked: 4 }),
    }),
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-20T11:00:00Z"));
  mocks.rows = [
    {
      id: "feedback-1",
      feedbackId: "feedback-1",
      sessionId: "session-1",
      participantId: "L-test",
      templateVersion: "v1",
      unblocked: null,
      oneLineOutcome: null,
      trust: null,
      completionState: "completed",
      endsAt: new Date("2026-10-20T10:00:00Z"),
    },
  ];
  mocks.update.mockReset();
  mocks.update.mockReturnValue({
    set: () => ({ where: async () => undefined }),
  });
  mocks.recordEvent.mockReset();
});

afterEach(() => vi.useRealTimers());

describe("rating access through page and API", () => {
  it.each(["scheduled", "started", "cancelled", "no_show"])(
    "rejects %s despite a valid rating link",
    async (completionState) => {
      mocks.rows[0].completionState = completionState;
      expect((await getRatingPage("a".repeat(43))).state).toBe("expired");
      expect((await submit()).status).toBe(410);
      expect(mocks.update).not.toHaveBeenCalled();
      expect(mocks.recordEvent).not.toHaveBeenCalled();
    },
  );

  it.each([null, new Date("2026-10-20T12:00:00Z")])(
    "rejects missing or future end time %s",
    async (endsAt) => {
      mocks.rows[0].endsAt = endsAt;
      expect((await getRatingPage("a".repeat(43))).state).toBe("expired");
      expect((await submit()).status).toBe(410);
      expect(mocks.update).not.toHaveBeenCalled();
      expect(mocks.recordEvent).not.toHaveBeenCalled();
    },
  );

  it("accepts completed feedback inside the window", async () => {
    expect((await getRatingPage("a".repeat(43))).state).toBe("form");
    expect(mocks.update).not.toHaveBeenCalled();
    expect((await submit()).status).toBe(200);
    expect(mocks.update).toHaveBeenCalledOnce();
    expect(mocks.recordEvent).toHaveBeenCalledOnce();
  });

  it("rejects a write after the cutoff without changing saved answers", async () => {
    mocks.rows[0].unblocked = 4;
    vi.setSystemTime(new Date("2026-10-20T12:00:00.001Z"));
    expect((await getRatingPage("a".repeat(43))).state).toBe("partial_expired");
    expect((await submit()).status).toBe(410);
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.recordEvent).not.toHaveBeenCalled();
  });
});
