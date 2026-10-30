# RESOURCES.md

## Project install status (2026-10-19)

- Impeccable is installed project-locally at `.agents/skills/impeccable/` (skill metadata 4.6.0; launcher VERSION 0.1.15), from `pbakaus/impeccable`, Apache-2.0.
- The Codex hook manifest is `.codex/hooks.json`. Codex requires the user to approve it in `/hooks` before it runs; do not bypass this trust step.
- Existing `PRODUCT.md` and `DESIGN.md` were preserved. Do not run Impeccable `init` to regenerate them unless the user asks.
- The app has a P0 shell. Run the installed Impeccable detector on UI files; the bootstrap screen returned no detector findings.

What to reuse so the coding agent does not reinvent things, and what to install so it does not produce generic AI-looking UI. Found by web search on 19 October 2026. I read repository README snippets and an overview article, not the full repositories. Star counts, versions and licenses must be checked before use. Skills are third-party instructions for your agent: read the `SKILL.md`, pin a commit or version, and do not install anything "latest" blindly.

## 1. Design skills for Codex

| Skill | Repo | Why | Notes |
|---|---|---|---|
| Impeccable | `pbakaus/impeccable` | One skill with commands such as `init`, `critique`, `polish`. `init` writes `PRODUCT.md` and `DESIGN.md` (audience, voice, anti-references, colors, type). Deterministic detector rules catch common AI-design patterns without an LLM. A hook can check UI files on edit, including in Codex. | Main pick. Install per its README (`npx impeccable install`). The rule count differs between versions, so do not rely on a number. It installs hooks: read what they do first. |
| frontend-design (Codex port) | `vipulgupta2048/codex-skills` | A Codex-native frontend design skill. Copy it to `.codex/skills/` in the repo so the whole team gets it through git. | Its README mentions an install line from a differently named repo, so verify the exact repository name before running anything. The original idea comes from Anthropic's `frontend-design` in `anthropics/skills`. |
| Taste Skill | `Leonxlnx/taste-skill` | Anti-slop rules; has a `gpt-taste` variant aimed at GPT/Codex and minimalist variants. `npx skills add https://github.com/Leonxlnx/taste-skill --skill "gpt-taste"` | Optional. It leans toward premium effects and animation, which does not fit this product. Prefer its minimalist variant if you use it. |
| avoid-ai-design | `funboy322/avoid-ai-design` | A cleanup pass: audits already-written UI for AI tells and rewrites them. | Use as a second pass after generation, not as the generator. |

Recommended combination: Impeccable for context and checks, plus at most one generator skill. Stacking several skills with different aesthetic rules makes the agent contradict itself.

Impeccable asks for design context. Do not let it generate `PRODUCT.md` and `DESIGN.md` from scratch: this pack already contains them. Point it at the existing files.

## 2. Agent instructions

- Codex reads `AGENTS.md` before doing any work. It looks for a global file in `~/.codex`, then the repository root, with per-directory override files supported. Official guide: https://developers.openai.com/codex/guides/agents-md
- Keep `AGENTS.md` short and operational. Put long reasoning in the docs it points to.
- Check that Codex actually loads it: run `codex --ask-for-approval never "Summarize the current instructions."` from the repo root, as the guide suggests.

## 3. Reuse, do not build

| Need | Use | Notes |
|---|---|---|
| App scaffold | `create-next-app` (official) with TypeScript, Tailwind, App Router, ESLint | Do not clone a SaaS starter; use the existing project. The selected auth library is integrated directly with the current schema. |
| UI primitives | shadcn/ui CLI, which copies components into your repo, built on Radix | Restyle to `DESIGN.md`. Accessible dialogs, selects, radios and focus handling come for free. |
| Icons | Lucide | Sparingly, 20 px. |
| Database | PostgreSQL, Drizzle ORM, drizzle-kit migrations | Docker Compose for local. |
| Validation | Zod | Same schemas on client and server. |
| Forms | Native forms with Server Actions plus Zod | Add `react-hook-form` only if a form truly needs it. |
| Private links | Node `crypto.randomBytes`; store a SHA-256 hash; add an expiry column | Keep for existing participant link flows. |
| Dates and time zone | Built-in `Intl.DateTimeFormat` with the `Asia/Almaty` zone | No date library unless a real need appears. Check that the runtime's tz database has the current Kazakhstan offset. |
| Rate limiting | A small counter table in Postgres | No Redis, no external service. |
| Participant accounts | Better Auth + Drizzle adapter | Selected by the user for the account-based workspace. Resend email is called through its HTTP API; keys stay in environment variables. |
| Tests | Vitest, Playwright | One smoke test per screen at 360 px. |
| Fonts | `next/font` with Source Serif 4 and Source Sans 3 | Verify Kazakh glyph coverage first (see `DESIGN.md`). |
| Event schema | `docs/DATA_DICTIONARY.md` | Already defined by the team. |

## 4. Things Codex must not build

Its own auth system, UI kit, date library, form framework, state manager, rate-limit service, animation system, analytics platform, chat or video, or payments. Public people search is approved but still needs its product/privacy spec.

## 5. Checklist before adding any dependency

Name, version, license, maintenance activity, why it is needed, how to remove it. Pin versions and commit the lockfile. Run `npm audit` before merging.
