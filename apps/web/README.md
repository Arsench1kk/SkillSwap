# SkillSwap web app

This app is in `apps/web`; project-level product and design documents are in the repository root.

## Local setup

```sh
cp .env.example .env
docker compose up -d db
npm ci
npm run db:migrate
npm run dev
```

The default local PostgreSQL port is `5433`. Never commit `.env` or real participant data.

## Data tables

| Table                  | What it stores                                                                                                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `participants`         | An anonymised role-prefixed participant ID, role, consent timestamps, optional campus/year, and active/withdrawn status.                                                                   |
| `account_participants` | Links an authenticated account to a separate anonymised learner or mentor participant ID. Account IDs stay out of requests, contacts, and event rows.                                      |
| `participant_contacts` | Phone or Telegram contact values in a separate PII table. Event records do not include or join this data.                                                                                  |
| `learner_requests`     | The learner's task category, task and attempts, deadline, meeting windows, give-back offer, and request status.                                                                            |
| `mentor_profiles`      | A mentor's display name (shown only after a match), short experience statement, and availability windows.                                                                                  |
| `skill_evidence`       | A mentor's category/topic, proof type/reference, and pending/verified/rejected state. Verification writes require an operator and are also checked by a database trigger.                  |
| `mentor_briefs`        | A request-specific mentor invitation, template version, sent/answer-by times, and brief status.                                                                                            |
| `matches`              | A request and mentor recommendation, its reason, the separate human decision and decision reason, proposed slot, acceptances, and match status.                                            |
| `sessions`             | A match's start/end in UTC, session template version, completion state, and Meet URL.                                                                                                      |
| `feedback`             | The optional unblocked/trust scores, one-line outcome, safety flag, and a missing reason paired with each missing value.                                                                   |
| `events`               | The append-only experiment/action ledger. Writes go through `recordEvent()`; the database rejects updates and deletes.                                                                     |
| `state_transitions`    | Append-only audit history for request/brief state changes, including actor, time, source, and reason code.                                                                                 |
| `link_tokens`          | SHA-256 token hashes, purpose, text subject ID, expiry, and revocation; text IDs support both UUID entities and anonymised participant IDs. Raw tokens are returned once and never stored. |
| `rate_limit_counters`  | Hashed rate-limit keys, time windows, counts, and expiry.                                                                                                                                  |
| `reports`              | Private problem-report category and optional description, kept outside the event log.                                                                                                      |
| `user`                 | Better Auth account identity, email verification state, and the account's current learner/mentor workspace role. Kept separate from participant events and contacts.                       |
| `session`              | Better Auth login sessions, linked to a user and expired by timestamp.                                                                                                                     |
| `account`              | Better Auth credential/provider records; password credentials are stored using Better Auth's password hashing.                                                                             |
| `verification`         | Short-lived Better Auth email-verification and password-reset challenges.                                                                                                                  |

All dates are stored as PostgreSQL `timestamptz`/UTC. Use `formatKazakhstanTime(date, locale)` for display in `Asia/Almaty` with a localized zone label.

## Commands

Run from this directory:

```sh
npm run db:generate
npm run db:migrate
npm run db:seed:rehearsal
npm run db:expire-feedback
npm run lint
npm run typecheck
npm test
npm run e2e
```

## Tests and the test database

Automated checks write fixtures, so they use a separate local database that is
recreated freely. `testing/database-target.ts` resolves it from an explicit
environment (`TEST_DATABASE_URL`, then `DATABASE_URL`; `.env*` files are not
used for this) and **refuses** any host other than localhost or any database
name without a separate `test` segment, before a pool, fixture or cleanup runs.

```sh
docker compose up -d db
npm run db:test:prepare   # create skillswap_test if missing and migrate it
npm run test:db           # unit + all PostgreSQL integration suites
npm run e2e               # app server and fixtures on the same test database
npm run db:test:reset     # drop, recreate and migrate (removes synthetic data)
```

Without a configured database, plain `npm test` still runs and prints a warning
that the PostgreSQL suites were skipped; in CI (`CI=true`) a missing database is
an error. E2E starts its own dev server on port 3100 with the test database and
does not reuse a running server unless `E2E_REUSE_SERVER=1`.

CI (`.github/workflows/ci.yml`) runs four independent jobs: format/lint/typecheck;
clean migrations, unit/integration and a from-scratch production build; an
upgrade migration from the PR base; Playwright E2E. Each job has its own runner
and database, so build output, dev output and test artifacts do not collide.

The rehearsal seed contains only synthetic rows and sets `data_origin = rehearsal` on every event it creates. Rehearsal data must never be analyzed as real demand.

Schedule `npm run db:expire-feedback` as a recurring server-side job so unanswered L5 fields are marked `no_reply` after the two-hour rating window. The deployment cadence is a team decision; opening the private rating link does not run expiry processing.

## Operator access

On the trusted operator workstation, run the administrative CLI from
`apps/web`. Set `SKILLSWAP_OPERATOR_ADMIN_DATABASE_URL` to the target database
owner's connection and set `SKILLSWAP_DATA_ORIGIN`.

```sh
npx tsx scripts/operator/manage-access.ts new-id
npx tsx scripts/operator/manage-access.ts grant <operator-id> [admin-id]
npx tsx scripts/operator/manage-access.ts revoke <operator-id> [admin-id]
```

Pass the same operator ID when retrying a grant or revoke. A retired ID stays
revoked. The administrator ID refers to an existing active operator if supplied.
Keep the database-owner connection in the administrator's environment.
Working commands use `DATABASE_URL` and an active operator ID:

```sh
npx tsx scripts/operator/publish-session.ts <operator-id> --list
npx tsx scripts/operator/publish-session.ts <operator-id> <session-uuid> <google-meet-url>
npm run db:export-events -- <operator-id>
```

## Skill proof retention

The **Skill proof retention** GitHub workflow runs hourly at minute 17 when
enabled. It runs the existing cleanup command and reports the number of expired
or withdrawn proof references removed. Verification results and events stay in
the database. Expired proof is already unavailable to the operator at the
30-day cutoff, even if a scheduled run is delayed.

Run **Actions → Skill proof retention → Run workflow → rehearsal** to check
the command with synthetic fixtures on an isolated PostgreSQL service. Before
enabling the pilot job:

1. Apply migration `0011` to the pilot database.
2. Use the `pilot-maintenance` GitHub environment with deployments restricted
   to the `main` branch. Set its `SKILLSWAP_PROOF_RETENTION_DATABASE_URL`
   secret to the pilot maintenance connection. The command reads
   `participants` and `skill_evidence` and updates only
   `skill_evidence.proof_reference`.
3. Set the repository Actions variable `SKILLSWAP_PROOF_RETENTION_ENABLED` to
   `true`. Use the `pilot` target for an immediate run on `main` and verify the
   result in the job log. Set the variable to `false` to pause future runs.

A server-side scheduler with access to the pilot database can run the same
command from `apps/web` with an explicit `DATABASE_URL`:

```sh
node --import tsx scripts/operator/purge-skill-proofs.ts
```

## Decisions and open questions

- `experiment` is nullable in the implementation because ordinary platform events may not belong to E1/E2/E3, although `docs/DATA_DICTIONARY.md` currently marks it required. The team should resolve that contradiction before analysis/export contracts are finalized.
- `state_transitions` is an additional audit table because the architecture requires every transition to preserve actor/time/source/reason, but the event dictionary has no general status-transition event. Confirm whether this separate history table is the intended long-term audit model.
- The docs name participant status, match status, and session completion state without defining their complete vocabularies. This implementation uses the enums in `src/db/schema.ts`; confirm them before real-pilot use.
- Reason-code values are not frozen in the docs. The schema stores them as text and requires them where specified; the closed list remains a team decision.
- Consent wording, retention for other private data, operator web authentication, token lifetime, safety escalation ownership, and policy for removing/retaining data after consent withdrawal remain open before a real pilot.
- The event dictionary requires `participant_id`, `role`, and `data_origin`, but system follow-ups may have no human actor. Event rows still require the participant they concern; state-transition records allow a system actor without a participant ID.
- `feedback.one_line_outcome` is user-authored free text. The docs do not specify whether contact-data screening or retention/deletion rules apply to it; it is deliberately not copied into events.
- `reports.details` is optional user-authored text stored separately from events. The approved pilot category set is temporary; define access, retention, and safety escalation before real use.
- Account identities are separate from the anonymised `participants`/event model. `account_participants` maps an authenticated user ID to one anonymised participant ID per role; the same account can map to learner and mentor participants. Account IDs and email addresses are never copied into requests, contact rows, or event rows.

## Accounts and email

Registration and email/password sign-in use Better Auth with the existing PostgreSQL/Drizzle database. Email verification is required before sign-in; password reset and verification messages use the Resend HTTP API. Copy `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`, `RESEND_API_KEY`, and `AUTH_EMAIL_FROM` from `.env.example` into a local/private environment. Generate a unique secret (for example `openssl rand -base64 32`) and configure a sender verified by Resend. Never commit the secret or API key. Without the Resend key and sender, auth routes return an explicit email-configuration failure; they do not fake successful delivery.

- L5 allows partial answers, preserves them, and does not allow overwriting an already saved field. A production scheduler and cadence for `db:expire-feedback` must be configured before the pilot.
