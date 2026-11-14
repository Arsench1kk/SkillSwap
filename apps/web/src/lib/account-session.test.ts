import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireAccountSession } from "./account-session";

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("./auth", () => ({ auth: { api: { getSession } } }));

describe("account session boundary", () => {
  beforeEach(() => {
    getSession.mockReset();
  });

  it("rejects missing authentication even if headers claim an account/role", async () => {
    getSession.mockResolvedValue(null);
    const headers = new Headers({
      "x-user-id": "someone-else",
      "x-active-role": "mentor",
    });
    await expect(requireAccountSession(headers)).rejects.toMatchObject({
      code: "unauthorized",
    });
  });

  it("returns only the verified account identity and active role, without PII", async () => {
    getSession.mockResolvedValue({
      user: {
        id: "verified-account",
        activeRole: "mentor",
        name: "SYNTHETIC NAME",
        email: "synthetic@example.test",
      },
      session: { token: "not-for-domain-context" },
    });
    const headers = new Headers({ "x-user-id": "someone-else" });
    await expect(requireAccountSession(headers, "mentor")).resolves.toEqual({
      authUserId: "verified-account",
      activeRole: "mentor",
    });
    expect(getSession).toHaveBeenCalledWith({ headers });
  });

  it("requires the active role rather than trusting a requested role", async () => {
    getSession.mockResolvedValue({
      user: { id: "verified-account", activeRole: "mentor" },
    });
    await expect(
      requireAccountSession(new Headers(), "learner"),
    ).rejects.toMatchObject({
      code: "active_role_required",
    });
  });

  it.each(["operator", "admin", undefined])(
    "rejects an invalid stored active role %s",
    async (activeRole) => {
      getSession.mockResolvedValue({
        user: { id: "verified-account", activeRole },
      });
      await expect(requireAccountSession(new Headers())).rejects.toMatchObject({
        code: "invalid_account_role",
      });
    },
  );

  it("does not reinterpret an auth service failure as signed-out/demo", async () => {
    const unavailable = new Error("auth_database_unavailable");
    getSession.mockRejectedValue(unavailable);
    await expect(requireAccountSession(new Headers())).rejects.toThrow(
      "auth_database_unavailable",
    );
  });
});
