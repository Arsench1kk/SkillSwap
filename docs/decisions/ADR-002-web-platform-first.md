# ADR-002: Build the web platform now, in TypeScript and Next.js

Decision: the team builds the SkillSwap web platform now rather than waiting for experiment results. Stack: TypeScript, Next.js App Router, Tailwind, shadcn/ui primitives, PostgreSQL with Drizzle, Zod, Vitest, Playwright.
Date: 2026-10-19
Context: the A6 documents describe a manual concierge MVP on Forms, Sheets, Telegram and Meet. The team decided the web platform is the priority. The coding agent works best with a mainstream TypeScript stack and the design skills found for Codex target that ecosystem.
Options considered: (a) stay on the manual concierge and delay the platform; (b) Python and Django for an internal tool only; (c) TypeScript and Next.js for the whole platform.
Chosen option: (c).
Why now: the team wants the platform in front of students quickly.
Hypothesis or evidence linked: none directly. A6-H02 (mentors accept structured briefs) is still the riskiest assumption, so screen M2 is built first and tested early. Building the platform does not validate demand.
Trade-offs: more engineering work before the team knows whether unfamiliar mentors accept briefs. If E1 later shows weak acceptance, part of the build may need to change.
What would invalidate it: nobody on the team can maintain TypeScript; a safety or privacy requirement the platform cannot meet.
Rollback or replacement path: forms and Sheets remain a working fallback. Keep the event schema and `template_version` so data can move.
Owner: not assigned. By RACI, technical architecture is Ruslan's. Confirm with him.
