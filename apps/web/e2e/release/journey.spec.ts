import { expect, test } from "@playwright/test";
import {
  toKazakhstanDateInput,
  toKazakhstanDateTimeInput,
} from "../../src/domain/time";
import { createAccount, disposeAccounts } from "../support/accounts";

/**
 * Release journey through real services only: no SQL inserts of matches,
 * sessions or feedback, no demo arrays, no mocked API. Shared fixtures in
 * e2e/support/fixtures.ts stay for isolated states and do not replace this.
 */

const DAY = 24 * 60 * 60 * 1000;

function requestPayload(contact: string) {
  const at = (days: number, hour: number) => {
    const date = new Date(Date.now() + days * DAY);
    date.setUTCHours(hour - 5, 0, 0, 0); // Asia/Almaty is UTC+5
    return toKazakhstanDateTimeInput(date);
  };
  return {
    category: "STEM",
    task: "My spreadsheet chart does not update when the source data changes.",
    tried: "Checked the formula range and refreshed the file.",
    deadline: toKazakhstanDateInput(new Date(Date.now() + 7 * DAY)),
    windows: [
      { start: at(2, 10), end: at(2, 11) },
      { start: at(3, 15), end: at(3, 16) },
    ],
    giveBack: "",
    contactType: "telegram",
    contact,
    consent: true,
  };
}

test.describe("release journey", () => {
  test("both roles register and a learner submits a request through real services", async ({
    baseURL,
  }) => {
    const learner = await createAccount(baseURL!, "learner");
    const mentor = await createAccount(baseURL!, "mentor");
    try {
      await test.step("sessions carry the chosen workspace role", async () => {
        const session = await learner.api.get("/api/auth/get-session");
        expect((await session.json()).user.activeRole).toBe("learner");
        const mentorSession = await mentor.api.get("/api/auth/get-session");
        expect((await mentorSession.json()).user.activeRole).toBe("mentor");
      });

      let requestId = "";
      await test.step("learner submits a request with the account", async () => {
        const response = await learner.api.post("/api/account/requests", {
          data: requestPayload("@e2e_journey_learner"),
        });
        expect(response.status(), await response.text()).toBe(201);
        const body = await response.json();
        expect(body.status).toBe("eligible");
        requestId = body.requestId;
      });

      await test.step("learner sees exactly their own request", async () => {
        const list = await learner.api.get("/api/account/requests");
        expect(list.status()).toBe(200);
        const { requests } = await list.json();
        expect(requests.map((r: { id: string }) => r.id)).toEqual([requestId]);
        // The private contact never appears in the learner list response.
        expect(JSON.stringify(requests)).not.toContain("@e2e_journey_learner");
      });
    } finally {
      await disposeAccounts(learner, mentor);
    }
  });

  test.fixme("operator verification → search → brief → proposal → confirmation → session → completion → rating", async () => {
    // Blocked until these exist as real services (see docs/launch/RELEASE_CHECKLIST.md):
    // - D5 operator access and verification/matching commands (R06; R03/R04)
    // - D3 public profile DTO + visibility predicate; D2 search (R01/R02)
    // - D4 session created inside the confirmation transaction (A03, R07)
    // - D4 completion/no-show recording and rating window (A05, R07)
    // Implement each step here through HTTP/UI as the owners merge them.
  });
});

test.describe("release privacy and access boundaries", () => {
  test("anonymous and wrong-role callers cannot read learner requests", async ({
    request,
    baseURL,
  }) => {
    expect((await request.get("/api/account/requests")).status()).toBe(401);
    const mentor = await createAccount(baseURL!, "mentor");
    try {
      const response = await mentor.api.get("/api/account/requests");
      expect(response.status()).toBe(403);
      expect((await response.json()).error).toBe("learner_role_required");
      const write = await mentor.api.post("/api/account/requests", {
        data: requestPayload("@e2e_wrong_role"),
      });
      expect(write.status()).toBe(403);
    } finally {
      await disposeAccounts(mentor);
    }
  });

  test("one learner never sees another learner's requests", async ({
    baseURL,
  }) => {
    const first = await createAccount(baseURL!, "learner");
    const second = await createAccount(baseURL!, "learner");
    try {
      const created = await first.api.post("/api/account/requests", {
        data: requestPayload("@e2e_first_learner"),
      });
      expect(created.status()).toBe(201);
      const list = await second.api.get("/api/account/requests");
      expect((await list.json()).requests).toEqual([]);
    } finally {
      await disposeAccounts(first, second);
    }
  });

  test("repeating an invalid request keeps returning a validation error", async ({
    baseURL,
  }) => {
    const learner = await createAccount(baseURL!, "learner");
    try {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const response = await learner.api.post("/api/account/requests", {
          data: { ...requestPayload("@e2e_invalid"), consent: false },
        });
        expect(response.status()).toBe(400);
      }
      const list = await learner.api.get("/api/account/requests");
      expect((await list.json()).requests).toEqual([]);
    } finally {
      await disposeAccounts(learner);
    }
  });
});
