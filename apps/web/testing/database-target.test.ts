import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCAL_TEST_DATABASE_URL,
  UnsafeTestDatabaseError,
  assertSafeTestDatabaseUrl,
  databaseTestsRequired,
  describeTarget,
  requireTestDatabase,
  resolveTestDatabase,
} from "./database-target";

const local = "postgres://u:secret@127.0.0.1:5433/skillswap_test";

describe("assertSafeTestDatabaseUrl", () => {
  it.each([
    "postgres://u:p@localhost:5432/skillswap_test",
    "postgresql://u:p@127.0.0.1/test_skillswap",
    "postgres://u:p@[::1]:5433/skillswap-test-e2e",
  ])("accepts local test database %s", (url) => {
    expect(() => assertSafeTestDatabaseUrl(url, "DATABASE_URL")).not.toThrow();
  });

  it.each([
    ["dev database", "postgres://u:p@127.0.0.1:5433/skillswap"],
    ["test only as substring", "postgres://u:p@localhost/contest"],
    ["remote host", "postgres://u:p@db.example.com:5432/skillswap_test"],
    ["managed provider", "postgres://u:p@ep-x.neon.tech/skillswap_test"],
    ["wrong protocol", "mysql://u:p@localhost/skillswap_test"],
    ["not a URL", "skillswap_test"],
  ])("rejects %s", (_label, url) => {
    expect(() => assertSafeTestDatabaseUrl(url, "DATABASE_URL")).toThrow(
      UnsafeTestDatabaseError,
    );
  });

  it("allows an explicitly listed CI service host", () => {
    const url = "postgres://u:p@postgres:5432/skillswap_test";
    expect(() => assertSafeTestDatabaseUrl(url, "DATABASE_URL")).toThrow();
    expect(
      assertSafeTestDatabaseUrl(url, "DATABASE_URL", {
        SKILLSWAP_TEST_DATABASE_HOSTS: "postgres",
      }).host,
    ).toBe("postgres");
  });

  it("never includes credentials in errors or descriptions", () => {
    const remote = "postgres://user:hunter2@db.example.com/skillswap_test";
    expect(() => assertSafeTestDatabaseUrl(remote, "DATABASE_URL")).toThrow(
      expect.objectContaining({
        message: expect.not.stringContaining("hunter2"),
      }),
    );
    const target = assertSafeTestDatabaseUrl(local, "TEST_DATABASE_URL");
    expect(describeTarget(target)).toBe(
      "127.0.0.1:5433/skillswap_test (from TEST_DATABASE_URL)",
    );
  });
});

describe("resolveTestDatabase", () => {
  it("prefers TEST_DATABASE_URL over DATABASE_URL", () => {
    const target = resolveTestDatabase({
      TEST_DATABASE_URL: local,
      DATABASE_URL: "postgres://u:p@127.0.0.1:5433/skillswap",
    });
    expect(target?.source).toBe("TEST_DATABASE_URL");
  });

  it("refuses a DATABASE_URL that points at the dev database", () => {
    expect(() =>
      resolveTestDatabase({
        DATABASE_URL: "postgres://u:p@127.0.0.1:5433/skillswap",
      }),
    ).toThrow(UnsafeTestDatabaseError);
  });

  it("returns null locally when nothing is configured", () => {
    expect(resolveTestDatabase({})).toBeNull();
    expect(databaseTestsRequired({})).toBe(false);
  });

  it("fails in CI when no database is configured", () => {
    expect(() => resolveTestDatabase({ CI: "true" })).toThrow(
      /may not be skipped/,
    );
  });

  it("uses the local compose test database when DB tests are required", () => {
    const target = resolveTestDatabase({ SKILLSWAP_REQUIRE_DB_TESTS: "1" });
    expect(target?.url).toBe(DEFAULT_LOCAL_TEST_DATABASE_URL);
  });
});

describe("requireTestDatabase", () => {
  it("always yields a verified target", () => {
    expect(requireTestDatabase({}).database).toBe("skillswap_test");
    expect(requireTestDatabase({ DATABASE_URL: local }).source).toBe(
      "DATABASE_URL",
    );
  });
});
