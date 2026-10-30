# PROMPTS.md

Ten prompts for Codex, in build order. Rules for using them:

1. One prompt per fresh Codex thread. Do not chain tasks in one long conversation.
2. Paste the prompt as written. Do not add "make it look modern".
3. Before the first prompt, make sure `AGENTS.md`, `PRODUCT.md`, `DESIGN.md` and the `docs/` files are in the repository root, and confirm Codex loads them.
4. After each task: run the checks, open the screen on a phone-size viewport, and read the summary. Merge only if the definition of done in `AGENTS.md` is met.
5. If Codex asks a question the docs should have answered, fix the docs, then continue.

Order and why: bootstrap, design tokens, data layer first, because every screen depends on them. Then the highest-risk screen (mentor brief), then the learner request, then the rest.

---

## P0 Bootstrap

Goal: an empty but correct project.

Read: `AGENTS.md`, `docs/RESOURCES.md`.

Do:
- Create the Next.js app with `create-next-app` (TypeScript, Tailwind, App Router, ESLint, no src directory decision beyond the default). Do not use a third-party starter.
- Add Prettier, Vitest, Playwright, Zod, Drizzle ORM and drizzle-kit, the `pg` driver.
- Add `docker-compose.yml` with PostgreSQL for local development, `.env.example`, and scripts for the commands listed in `AGENTS.md`.
- Add `messages/en.ts` as the single strings file with a typed key accessor.
- Add CI config that runs lint, typecheck and unit tests.
- Update the Commands section of `AGENTS.md`.

Do not: add auth, any UI beyond a blank home page, or any dependency not in `docs/RESOURCES.md` without listing it.

Done when: the dev server runs, tests run (even if only one), Postgres starts through Docker Compose, and the summary lists every dependency with its license.

## P1 Design tokens and primitives

Goal: the visual foundation, matching `DESIGN.md` exactly.

Read: `DESIGN.md`, `PRODUCT.md`.

Do:
- Implement the color, type, spacing, radius and focus tokens as CSS variables and Tailwind theme values. Load the fonts with `next/font` and a system fallback.
- Initialise shadcn/ui and restyle Button, Input, Textarea, Label, RadioGroup, Checkbox, Select, Alert to the tokens. No default shadcn look left.
- Build SkillSwap components: Field (label, hint, error), Choice row, TimeSlotChip, Notice, CompetenceCard (key-value rows, no stars), StatusLine, StickyActionBar.
- Create a non-production `/dev/kit` page that shows every component in every state at 360 px and desktop.
- Tests: contrast of token pairs against the table in `DESIGN.md`; a Playwright smoke test of `/dev/kit`.

Do not: use gradients, shadows other than the focus ring, emoji, illustrations, or any color not in `DESIGN.md`.

Done when: `/dev/kit` renders, keyboard focus is visible everywhere, and the design skill critique (if installed) reports no unresolved issues.

## P2 Data layer, events and private links

Goal: the data foundation that every screen uses.

Read: `docs/UX_SPEC.md` sections 4 and 7, `docs/DATA_DICTIONARY.md`, `docs/context/TECHNICAL_ARCHITECTURE_PLAN.md`.

Do:
- Drizzle schema and migration for: participants (anonymised id, role, consent timestamps), a separate private table for contact details, learner requests, mentor profiles with skill evidence and verification state, briefs (with `template_version`), matches, sessions, feedback, events, link tokens, rate-limit counters.
- `recordEvent()`: the only way events are written. Validates against the names and rules in the data dictionary. Rejects contact data in notes. Server sets `participant_id` and `data_origin`.
- Private links: random token, only the SHA-256 hash stored, purpose, subject id, expiry, revocation. Verification helper that returns a typed result (valid, expired, revoked, not found).
- Time helpers: store UTC, format in Kazakhstan local time with the zone label.
- Seed script with clearly fake data marked `rehearsal`.
- Tests for: token creation and expiry, event validation, contact separation, time formatting.

Do not: add accounts, passwords or sessions. Do not store contact details in any events table.

Done when: migrations apply cleanly on an empty database, tests pass, and a README section explains the tables in plain words.

## P3 Mentor brief page (M2)

Goal: the highest-risk screen, built first.

Read: `docs/UX_SPEC.md` sections 2, 3, 6 (M2, 6.1), 8, 10; `DESIGN.md`; `PRODUCT.md`.

Do:
- Build `/brief/:token`: shows the learner's task, what they tried, deadline, 45-minute time box, give-back skill and the no-show rule, with a clear answer-by time.
- Actions: "Propose a time" (learner's windows as TimeSlotChips plus suggest another) and "I can not help with this" with the closed list of decline reasons from the spec.
- States: unanswered, already answered (changeable until confirmed), learner cancelled, expired link (X1 page), network failure.
- Events: `mentor_viewed`, `mentor_accepted` with `slot_proposed`, `decline_reason`. Record `template_version`.
- Copy from the strings file, drafted from the spec's placeholder copy; mark every string `TODO(team)` in the strings file so the team can rewrite it.
- Playwright: all states at 360 px, keyboard-only path.

Do not: show learner contact details, add ratings, avatars or any element not in the spec.

Done when: a mentor can understand the task and answer in about a minute on a phone, and all states exist.

## P4 Learner request form (L1)

Read: `docs/UX_SPEC.md` L1, section 10; `DESIGN.md`.

Do: `/request` as a single page with the fields and rules in the spec; draft autosave in the browser; inline validation that never clears the form; ineligible-request handling with a helpful message; consent checkbox linking to the privacy page; on submit create the request, record `request_submitted` and `eligibility_checked`, and send the learner to their private status page. Server-side Zod validation and rate limiting. Playwright test: complete the form unaided path at 360 px.

Do not: add steps, accounts, or optional fields not in the spec.

## P5 Learner status pages (L2, L3)

Read: `docs/UX_SPEC.md` L2, L3, 6.1; `DESIGN.md`.

Do: `/request/:token` with states waiting, no match after 24 hours, matched (competence card and proposed slot, confirm or ask for another time), cancelled, mentor withdrew. Contact details are revealed only after both sides accepted. Events: `match_accepted`. Editing of deadline and time windows until matched.

## P6 Session page (L4)

Read: `docs/UX_SPEC.md` L4; `DESIGN.md`.

Do: `/session/:token` for both people with the one-page plan, time box, rules, a link button to Google Meet (a URL stored by the operator, opened in a new tab), "I cannot make it", and report. Events: `session_started`, `session_completed`, `no_show`. Versioned template (`template_version`). Do not embed video or chat.

## P7 Rating page (L5)

Read: `docs/UX_SPEC.md` L5.

Do: `/rate/:token` with the three inputs only (unblocked 1–5, one-line outcome, trust 1–5), the report link, states for skipped, partial and already submitted. Skipped is stored as missing, never zero. Events: `usefulness_submitted`, `trust_submitted`.

## P8 Mentor join (M1)

Read: `docs/UX_SPEC.md` M1, section 9.

Do: `/mentor/join` with the spec's fields, clear statement of what is shown to learners and when, consent, and a confirmation page (M3). Proof is stored as a reference supplied by the mentor (a link or note); no file uploads in v1. Verification state is set only by the operator.

## P9 Entry, privacy, report, expired link

Read: `docs/UX_SPEC.md` E0, X1, X2, X3; `PRODUCT.md`.

Do: the entry page (who it is for, three plain steps, one primary action, quiet link for mentors), the report page (always reachable from token pages, records `safety_flag` with a reason), the expired-link page, and the privacy page with placeholder text marked `TODO(legal)`. No hero imagery, no counters, no testimonials.

## P10 Minimal operator tooling

Goal: let a human run the service without touching the database.

Do: the smallest possible private page or script set that lets an operator view requests, mark eligibility, create a brief for a chosen mentor, set the Meet URL, generate and copy private links to send by Telegram, mark no-show, and export events as CSV. Protect it properly: do not ship a hard-coded password. Use a real auth library (Better Auth or Auth.js, see `docs/RESOURCES.md`) or keep it as local CLI scripts until that is added. List the security decisions in the summary.

Done when: a person can take a request through to a session link without editing the database by hand.
