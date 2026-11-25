import { spawnSync } from "node:child_process";
import { Client } from "pg";
import { describe, expect, it, vi } from "vitest";
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
    [
      "malformed database encoding",
      "postgres://u:p@localhost/skillswap_test_%ZZ",
    ],
    [
      "malformed password encoding",
      "postgres://u:%ZZ@localhost/skillswap_test",
    ],
  ])("rejects %s", (_label, url) => {
    expect(() => assertSafeTestDatabaseUrl(url, "DATABASE_URL")).toThrow(
      UnsafeTestDatabaseError,
    );
  });

  it.each([
    "host=remote.example.test",
    "host=/tmp/postgresql",
    "host=%2Ftmp%2Fpostgresql",
    "port=6543",
    "%68ost=remote.example.test",
    "host=localhost&host=remote.example.test",
    "port=5432&port=6543",
    "connectionString=postgres%3A%2F%2Fremote.example.test%2Fskillswap_test",
    "sslcert=/tmp/private-cert",
    "sslmode=disable",
  ])("rejects query parameters before pg can interpret them: %s", (query) => {
    expect(() =>
      assertSafeTestDatabaseUrl(`${local}?${query}`, "TEST_DATABASE_URL"),
    ).toThrow(UnsafeTestDatabaseError);
  });

  it("keeps the verified default port even when PGPORT is set", () => {
    vi.stubEnv("PGPORT", "6543");
    try {
      const target = assertSafeTestDatabaseUrl(
        "postgres://u:p@localhost/skillswap_test",
        "TEST_DATABASE_URL",
      );
      const client = new Client({ connectionString: target.url });
      expect(client.port).toBe(Number(target.port));
      expect(client.port).toBe(5432);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it.each([
    "postgres://u:p@localhost:5432/skillswap_test",
    "postgresql://u:p@127.0.0.1:5433/test_skillswap",
    "postgres://u:p@[::1]:5433/skillswap-test-e2e",
    "postgres://u:p@localhost/skillswap_test_other%2Fother",
  ])("checks the same target pg will use without connecting: %s", (url) => {
    const target = assertSafeTestDatabaseUrl(url, "TEST_DATABASE_URL");
    const client = new Client({ connectionString: target.url });
    expect(client.host).toBe(target.host.replace(/^\[(.+)\]$/, "$1"));
    expect(client.port).toBe(Number(target.port));
    expect(client.database).toBe(target.database);
  });

  it("refuses reset before constructing a database client", () => {
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "testing/prepare-database.ts", "--reset"],
      {
        encoding: "utf8",
        timeout: 10_000,
        env: {
          ...process.env,
          TEST_DATABASE_URL:
            "postgres://u:reset-secret@localhost/skillswap_test?host=remote.example.test",
        },
      },
    );
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("must not contain query parameters");
    expect(result.stderr).not.toContain("reset-secret");
    expect(result.stdout).not.toContain("[test-db] target");
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
