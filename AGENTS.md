# AGENTS.md

The web app lives in `apps/web`. Paths in this file, `DESIGN.md` and `docs/` such as `messages/en.ts`, `/dev/kit`, and the database schema refer to paths relative to `apps/web`; run web-app commands from `apps/web`. Project guidance and design documents remain in the repository root (use `../../` to reach them from the app directory).

SkillSwap is a web platform where a university student in Almaty or Astana who is stuck on a specific task gets a free 45-minute session with a verified peer. A human operator matches people; the platform handles requests, mentor briefs, sessions and ratings.

Read these before any task, in this order:

1. `PRODUCT.md` (who it is for, voice, what it must never feel like)
2. `DESIGN.md` (tokens, components, layout rules)
3. `docs/UX_SPEC.md` (screens, states, copy, events)
4. `docs/DATA_DICTIONARY.md` (event schema)
5. `docs/RESOURCES.md` (what to reuse instead of building)

If something you need is not in these files, stop and ask. Do not invent screens, fields, events, copy or design decisions.

## Team assignments — read before implementation

After the five documents above, read `docs/launch/README.md`, then `docs/launch/PLAN.md`, `docs/launch/DECISIONS.md`, and the named task for the teammate you are assisting. These files define the current launch work, ownership, dependencies and acceptance criteria; `docs/PROMPTS.md` is the earlier build sequence, not a replacement for the team plan.

- D1 Арсен: platform, auth, shared contracts, schema/migrations and shell integration.
- D2 Руслан: learner requests and discovery.
- D3 Амир: mentor flow and profiles.
- D4 Нурлан: sessions, feedback and lifecycle jobs.
- D5 Тогжан: operator tooling, manual matching and reports.
- D6 Андрей: CI, i18n, shared UI/configuration and release checks.

Determine your teammate/task from the user's instruction. If it is missing or ambiguous, ask which teammate you are assisting before changing implementation; do not infer identity from Git author settings or take over all six packages. State your task ID, current G0/G1 gate, allowed files and dependencies before editing.

Follow the ownership matrix in `docs/launch/PLAN.md`. Only D1 authors shared schema/migrations; only D6 edits message catalogs, package/lockfiles and shared configuration, except the explicitly coordinated G0 refactor/formatting. Request changes from the file owner instead of modifying their module or copying its business logic. Do not implement proposed feature directories/screens until their specification and dependencies are ready. Open product decisions are not approved requirements; continue independent work while clarifying dependent decisions.

Use a task branch and small PRs, preserving other contributors' work. The user can explicitly authorize publication, but do not push feature changes directly to `main` by default. Keep production data, secrets, raw private links and generated screenshots out of task commits. The audit records a specific local snapshot and does not assert that its unpublished application changes exist on GitHub.

## Cross-team handoffs — applies to every teammate and agent

Before implementation, read `docs/launch/HANDOFFS.md` and the author journals it lists. Read records addressed to your D-code or to everyone, inspect the referenced PR/code at the recorded head SHA, and check its current GitHub status and dependencies. Draft code is available for coordination but is not necessarily in `main` or a final contract. If a dependency is unavailable, state that and continue independent work; do not invent or duplicate its implementation.

Before finishing any task, assess its effect on other owners: APIs/types, shared helpers, migrations, strings, UI entry points, configuration, tests, ownership or blockers. For cross-team impact, update your own `docs/launch/handoffs/Dn_NAME.md` with recipients, PR/branch/head SHA, base/dependencies, affected paths/symbols, required recipient action and validation/limitations. Update the same record when the advertised contract or PR status changes, including closure or replacement. Reference the handoff ID in the PR and final summary. If there is no cross-team impact, say so briefly in the PR instead of creating an empty notification.

Each teammate owns their author journal and records their own adoption/blockers there. This is a narrow coordination-document exception to D6's general documentation ownership; it does not permit editing another owner's implementation or product specs. Personal task files permanently link these journals, so new handoffs normally require only the sender's file to change. Do not mark a handoff adopted on another teammate's behalf.

Publish coordination documentation so it is visible from the default branch (a separate docs PR or an already-authorized docs-only push); publishing a draft feature PR alone does not deliver instructions to agents reading `main`. Preserve unrelated code and never merge feature code merely to deliver a note. If documentation is still only in a branch/PR, report that publication is pending, with its link. Follow `HANDOFFS.md` for the record format and safe dependency review.

## Stack (decided defaults)

TypeScript, Next.js App Router, Tailwind CSS, shadcn/ui primitives (restyled with our tokens), PostgreSQL with Drizzle ORM and drizzle-kit migrations, Zod for validation, Vitest for unit tests, Playwright for end-to-end tests, Docker Compose for local Postgres. Server Actions or route handlers for mutations. No separate backend service.

## Commands

Run web commands from `apps/web`:

```
npm run dev        # local dev server
npm run lint
npm run typecheck
npm test           # Vitest
npm run e2e        # Playwright
npm run db:migrate
```

## Reuse first

Before writing any non-trivial component, utility or integration, check `docs/RESOURCES.md` and the existing code. Prefer a maintained, widely used library to custom code. If you add a dependency, list its name, version, license and why in the task summary. Do not copy code from a repository without preserving its license notice.

Do not build: your own auth system, a date library, a UI kit, a form framework, a state manager, a rate limiter service, an animation system, an analytics platform.

## Scope rules

- Out of scope: payments, AI or embedding matching, in-app chat or video, social feeds/follows, native apps. Meet and Telegram stay external.
- Accounts are the primary workspace path. Use Better Auth with the existing Postgres/Drizzle database; never build custom password/session logic. One account can use learner and mentor roles and switch its active role. Keep existing private-link participant flows working where still used.
- Public profiles and people search are approved product direction. Their exact fields, visibility, moderation, and privacy rules must be specified before implementing those surfaces; do not invent them.
- Matching and verification are manual by an operator. Never write copy that says "instant", "AI-powered" or promises a match.

## Data rules

- Every meaningful action records an event using the names in `docs/DATA_DICTIONARY.md`, through one function (`recordEvent`). Events are append-only; corrections are new rows.
- Events never contain contact details, names or free text with contact data. Contact details live in a separate private table.
- The server sets `data_origin` and `participant_id`. The client can never set them.
- Missing data is stored as missing with a reason, never as zero.
- Times are stored in UTC and shown in Kazakhstan local time with the zone label visible.
- Every brief and session template has a `template_version` recorded with its events.
- Better Auth account email and credentials remain in its separate auth tables; never copy them into events. Linking accounts to anonymised participant records needs an explicit documented model.

## Design rules

- Use tokens from `DESIGN.md` only. No hard-coded colors, font sizes, radii or shadows in components.
- Every user-facing string comes from the strings file (`messages/en.ts`), keyed by id, so Russian and Kazakh can be added later. No copy invented inline.
- Do not leave shadcn defaults unchanged. Restyle to the tokens.
- Avoid the usual AI-generated look: gradient hero blobs, generic stock icons, emoji as decoration, three identical feature cards, fake testimonials or counters, decorative animation, centered-everything layouts. `PRODUCT.md` lists the anti-references.
- Mobile first, designed at 360 px wide. Tap targets at least 44 by 44 px. Works without JavaScript for reading pages where practical, forms keep typed text on error.
- Accessibility is not optional: labels on every field, visible focus, contrast per `DESIGN.md`, no meaning by color alone, keyboard operable.
- If a design skill is installed (for example Impeccable), run its critique and detector on every UI task before reporting done.

## Working agreement

- One screen or one concern per task. Small, reviewable diffs.
- Start every UI task by stating which screen ID from `docs/UX_SPEC.md` you are building and listing the states you will cover.
- Write tests for logic (tokens, events, validation, time formatting) and one Playwright smoke test per screen at 360 px width.
- Never commit secrets. Provide `.env.example`. Validate all input with Zod on the server. Rate-limit public form endpoints in a simple way (database counters), not with a new service.
- Do not rewrite unrelated files or reformat the whole repository.

## Definition of done

A task is done only when all are true:

1. Lint, typecheck and tests pass.
2. Every state listed for the screen in `docs/UX_SPEC.md` exists (empty, loading, error, expired, and so on).
3. The right events are recorded and tested.
4. Strings come from the strings file; tokens come from `DESIGN.md`.
5. The screen works at 360 px and with keyboard only.
6. The summary lists what was built, what was skipped and why, dependencies added, and open questions.
7. Cross-team impact is assessed. Relevant handoffs are updated in the author's journal and their publication location is reported; otherwise the PR states that there is no cross-team impact.
