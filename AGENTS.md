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
