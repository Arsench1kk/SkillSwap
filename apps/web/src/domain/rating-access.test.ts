import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  update: vi.fn(),
  recordEvent: vi.fn(),
  verify: vi.fn(),
  rateLimit: vi.fn(),
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
  verifyPrivateLink: mocks.verify,
}));
vi.mock("@/domain/rate-limit", () => ({
  allowRateLimitedAttempt: mocks.rateLimit,
}));
vi.mock("@/domain/events", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./events")>();
  return { ...actual, recordEvent: mocks.recordEvent };
});
vi.mock("@/domain/mentor-brief-page", () => ({
  currentDataOrigin: () => "rehearsal",
}));

import { getRatingPage } from "./rating-page";
import { POST } from "../../app/api/rating/route";

function submit(payload: Record<string, unknown> = { unblocked: 4 }) {
  return POST(
    new Request("http://localhost/api/rating", {
      method: "POST",
      body: JSON.stringify({ token: "a".repeat(43), ...payload }),
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
  mocks.verify.mockReset().mockResolvedValue({
    status: "valid",
    purpose: "rating",
    subjectType: "feedback",
    subjectId: "feedback-1",
  });
  mocks.rateLimit.mockReset().mockResolvedValue(true);
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

describe("L5 input and access safeguards", () => {
  it.each(["expired", "revoked", "not_found"])(
    "rejects a %s link",
    async (status) => {
      mocks.verify.mockResolvedValue({ status });
      expect(await getRatingPage("a".repeat(43))).toEqual({ state: "expired" });
      expect((await submit()).status).toBe(410);
      expect(mocks.update).not.toHaveBeenCalled();
      expect(mocks.recordEvent).not.toHaveBeenCalled();
    },
  );
  it.each([
    { purpose: "session", subjectType: "feedback" },
    { purpose: "rating", subjectType: "participant" },
  ])("rejects mismatched scope %j", async (scope) => {
    mocks.verify.mockResolvedValue({
      status: "valid",
      subjectId: "feedback-1",
      ...scope,
    });
    expect((await getRatingPage("a".repeat(43))).state).toBe("expired");
    expect((await submit()).status).toBe(410);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("rejects a missing feedback target", async () => {
    mocks.rows = [];
    expect((await getRatingPage("a".repeat(43))).state).toBe("expired");
    expect((await submit()).status).toBe(410);
    expect(mocks.recordEvent).not.toHaveBeenCalled();
  });
  it.each([
    {},
    { unblocked: 0 },
    { trust: 6 },
    { trust: 1.5 },
    { oneLineOutcome: " " },
    { oneLineOutcome: "x".repeat(281) },
    { unblocked: 4, participantId: "L-forged" },
    { unblocked: 4, dataOrigin: "real_pilot" },
  ])("rejects invalid input %j before access checks", async (payload) => {
    expect((await submit(payload)).status).toBe(400);
    expect(mocks.verify).not.toHaveBeenCalled();
    expect(mocks.rateLimit).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it.each([
    "Email me at learner@example.com",
    "Contact @learner_test",
    "Call +7 777 123 45 67",
  ])("uses the real contact predicate: %s", async (oneLineOutcome) => {
    expect((await submit({ oneLineOutcome })).status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.recordEvent).not.toHaveBeenCalled();
  });
  it("rejects exhausted quota before link verification", async () => {
    mocks.rateLimit.mockResolvedValue(false);
    expect((await submit()).status).toBe(429);
    expect(mocks.verify).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("does not overwrite answered fields", async () => {
    mocks.rows[0].unblocked = 4;
    const response = await submit({ unblocked: 5 });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "already_answered" });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.recordEvent).not.toHaveBeenCalled();
  });
  it("returns thank-you and prevents full resubmission", async () => {
    Object.assign(mocks.rows[0], {
      unblocked: 4,
      trust: 5,
      oneLineOutcome: "Solved the task",
    });
    expect(await getRatingPage("a".repeat(43))).toEqual({ state: "submitted" });
    const response = await submit();
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "already_submitted" });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.recordEvent).not.toHaveBeenCalled();
  });
  it("records server identity and template version", async () => {
    expect((await submit({ trust: 5 })).status).toBe(200);
    expect(mocks.recordEvent).toHaveBeenCalledWith(
      expect.anything(),
      {
        participantId: "L-test",
        dataOrigin: "rehearsal",
        templateVersion: "v1",
      },
      { eventName: "trust_submitted", value: 5 },
    );
  });
});
