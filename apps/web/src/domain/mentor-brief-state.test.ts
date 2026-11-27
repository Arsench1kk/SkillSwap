import { describe, expect, it } from "vitest";
import {
  resolveMentorBriefGate,
  type MentorBriefGateInput,
} from "./mentor-brief-state";

const now = new Date("2026-11-20T10:00:00.000Z");
const past = new Date(now.getTime() - 60_000);
const future = new Date(now.getTime() + 60_000);

const base: MentorBriefGateInput = {
  mentorRole: "mentor",
  mentorStatus: "active",
  requestStatus: "matching",
  briefStatus: "invited",
  matchStatus: null,
  answerBy: future,
};

describe("resolveMentorBriefGate", () => {
  it("keeps a confirmed brief confirmed after the answer-by time", () => {
    expect(
      resolveMentorBriefGate(
        { ...base, briefStatus: "confirmed", answerBy: past },
        now,
      ),
    ).toBe("confirmed");
  });

  it("treats an accepted match or a scheduled session as confirmed after the deadline", () => {
    expect(
      resolveMentorBriefGate(
        {
          ...base,
          briefStatus: "slot_proposed",
          matchStatus: "accepted",
          answerBy: past,
        },
        now,
      ),
    ).toBe("confirmed");
    expect(
      resolveMentorBriefGate(
        {
          ...base,
          briefStatus: "accepted",
          requestStatus: "session_scheduled",
          answerBy: past,
        },
        now,
      ),
    ).toBe("confirmed");
  });

  it("expires an invited brief once the answer-by time has passed", () => {
    expect(resolveMentorBriefGate({ ...base, answerBy: past }, now)).toBe(
      "expired",
    );
    expect(resolveMentorBriefGate({ ...base, answerBy: now }, now)).toBe(
      "expired",
    );
    expect(
      resolveMentorBriefGate({ ...base, briefStatus: "expired" }, now),
    ).toBe("expired");
  });

  it("shows a cancelled request as cancelled, even if it was confirmed", () => {
    expect(
      resolveMentorBriefGate({ ...base, requestStatus: "cancelled" }, now),
    ).toBe("cancelled");
    expect(
      resolveMentorBriefGate(
        {
          ...base,
          requestStatus: "cancelled",
          briefStatus: "confirmed",
          answerBy: past,
        },
        now,
      ),
    ).toBe("cancelled");
  });

  it("checks the mentor before anything else", () => {
    expect(
      resolveMentorBriefGate(
        { ...base, mentorStatus: "withdrawn", briefStatus: "confirmed" },
        now,
      ),
    ).toBe("expired");
    expect(
      resolveMentorBriefGate(
        { ...base, mentorRole: "learner", requestStatus: "cancelled" },
        now,
      ),
    ).toBe("expired");
  });

  it("leaves an open brief before its deadline to the page", () => {
    expect(resolveMentorBriefGate(base, now)).toBe("open");
    expect(
      resolveMentorBriefGate({ ...base, briefStatus: "slot_proposed" }, now),
    ).toBe("open");
  });
});
