/**
 * Single source of truth for which PostgreSQL database automated checks may
 * write to. Vitest, Playwright and the prepare/reset script all resolve their
 * target here and refuse anything that does not look like a disposable local
 * test database. Fixtures and cleanup run only after this check passes.
 *
 * Resolution order (explicit environment always wins over `.env*` files,
 * which these tools never read for this purpose):
 *   1. TEST_DATABASE_URL
 *   2. DATABASE_URL, only if it passes the same safety check
 *   3. the local Docker Compose test database, only when DB checks are
 *      required (`SKILLSWAP_REQUIRE_DB_TESTS=1`) outside CI
 */

export const DEFAULT_LOCAL_TEST_DATABASE_URL =
  "postgres://skillswap:skillswap@127.0.0.1:5433/skillswap_test";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/** A database name must contain a separate `test` segment, e.g. `skillswap_test`. */
const TEST_DATABASE_NAME = /(^|[_-])test([_-]|$)/i;

/**
 * Reads TEST_DATABASE_URL, DATABASE_URL, CI, SKILLSWAP_REQUIRE_DB_TESTS and
 * SKILLSWAP_TEST_DATABASE_HOSTS. Accepts `process.env` directly.
 */
export type TestDatabaseEnv = Record<string, string | undefined>;

export class UnsafeTestDatabaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeTestDatabaseError";
  }
}

export type DatabaseTarget = {
  url: string;
  host: string;
  port: string;
  database: string;
  source: "TEST_DATABASE_URL" | "DATABASE_URL" | "default";
};

/** Host and database name only; never print credentials. */
export function describeTarget(target: DatabaseTarget): string {
  return `${target.host}:${target.port}/${target.database} (from ${target.source})`;
}

function isTruthy(value: string | undefined) {
  return value === "1" || value === "true";
}

export function databaseTestsRequired(env: TestDatabaseEnv): boolean {
  return isTruthy(env.CI) || isTruthy(env.SKILLSWAP_REQUIRE_DB_TESTS);
}

function allowedHosts(env: TestDatabaseEnv) {
  const extra = (env.SKILLSWAP_TEST_DATABASE_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  return new Set([...LOCAL_HOSTS, ...extra]);
}

/** Throws UnsafeTestDatabaseError unless `url` names a local `*_test` database. */
export function assertSafeTestDatabaseUrl(
  url: string,
  source: DatabaseTarget["source"],
  env: TestDatabaseEnv = {},
): DatabaseTarget {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new UnsafeTestDatabaseError(`${source} is not a valid URL.`);
  }
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new UnsafeTestDatabaseError(
      `${source} must use the postgres:// protocol.`,
    );
  }
  // pg accepts query keys as connection options, including host/port and even
  // a nested connectionString. Test tools deliberately support no URL query
  // options: reject them before pg can read files, connect or reset a database.
  if (parsed.search) {
    throw new UnsafeTestDatabaseError(
      `${source} must not contain query parameters; put host and port in the URL authority.`,
    );
  }
  // pg otherwise takes an omitted port from PGPORT, not necessarily 5432.
  parsed.port ||= "5432";
  const host = parsed.hostname.toLowerCase();
  let database: string;
  try {
    // Match pg-connection-string: reserved URI characters remain escaped.
    database = decodeURI(parsed.pathname.replace(/^\//, ""));
    decodeURIComponent(parsed.username);
    decodeURIComponent(parsed.password);
  } catch {
    throw new UnsafeTestDatabaseError(
      `${source} contains invalid URL encoding.`,
    );
  }
  const target: DatabaseTarget = {
    url: parsed.toString(),
    host,
    port: parsed.port || "5432",
    database,
    source,
  };
  if (!allowedHosts(env).has(host)) {
    throw new UnsafeTestDatabaseError(
      `Refusing to run tests against ${describeTarget(target)}: host is not local. ` +
        "Add it to SKILLSWAP_TEST_DATABASE_HOSTS only if it is a disposable CI service.",
    );
  }
  if (!TEST_DATABASE_NAME.test(database)) {
    throw new UnsafeTestDatabaseError(
      `Refusing to run tests against ${describeTarget(target)}: the database name ` +
        "must contain a separate `test` segment (for example `skillswap_test`).",
    );
  }
  return target;
}

/**
 * Returns the verified target, or `null` when DB checks are optional and no
 * database was given (local `npm test`; DB suites then report as skipped).
 */
export function resolveTestDatabase(
  env: TestDatabaseEnv,
): DatabaseTarget | null {
  if (env.TEST_DATABASE_URL) {
    return assertSafeTestDatabaseUrl(
      env.TEST_DATABASE_URL,
      "TEST_DATABASE_URL",
      env,
    );
  }
  if (env.DATABASE_URL) {
    return assertSafeTestDatabaseUrl(env.DATABASE_URL, "DATABASE_URL", env);
  }
  if (isTruthy(env.CI)) {
    throw new UnsafeTestDatabaseError(
      "CI must set TEST_DATABASE_URL explicitly; database tests may not be skipped.",
    );
  }
  if (isTruthy(env.SKILLSWAP_REQUIRE_DB_TESTS)) {
    return assertSafeTestDatabaseUrl(
      DEFAULT_LOCAL_TEST_DATABASE_URL,
      "default",
      env,
    );
  }
  return null;
}

/** Like resolveTestDatabase, but a database is mandatory (E2E, prepare/reset). */
export function requireTestDatabase(env: TestDatabaseEnv): DatabaseTarget {
  return (
    resolveTestDatabase({ ...env, SKILLSWAP_REQUIRE_DB_TESTS: "1" }) ??
    assertSafeTestDatabaseUrl(DEFAULT_LOCAL_TEST_DATABASE_URL, "default", env)
  );
}
