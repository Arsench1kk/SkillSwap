# SkillSwap Technical Architecture Plan

> Status: this phased recommendation predates the platform-first direction in `docs/decisions/ADR-002-web-platform-first.md`. Use ADR-002 and `docs/PROMPTS.md` for current implementation sequencing; retain the privacy, manual-override and evidence-validity constraints below.

## Architecture thesis

Build only what the next experiment requires. The first product is a manual concierge workflow. The first code should make the experiment reliable, auditable and replaceable; it should not encode unproven marketplace complexity.

## Recommended phases

### Phase 0 Manual validation

Telegram, Google Forms, Google Sheets and Google Meet remain the operational system. Add a small private repository only for:

- versioned schemas and reason codes;
- experiment scripts and data cleaning;
- a local event ledger or CSV export;
- analysis notebooks or SQL queries;
- consent and safety templates.

No public user accounts, payment processing or AI matching.

### Phase 1 Thin internal operations tool

Build a small authenticated operations dashboard after E1–E3 show that the workflow is worth repeating:

- learner request intake;
- mentor competence cards;
- eligibility review;
- match queue;
- timestamps and SLA alerts;
- session status;
- feedback and guardrail reports.

The operator must be able to correct data and replay a failed workflow. Every automated action must have a manual override.

### Phase 2 Private pilot web app

Only after repeated concierge cohorts:

- learner and mentor sign-in;
- request creation;
- consent and profile verification;
- structured matching suggestions;
- acceptance and scheduling;
- session template;
- feedback and reporting.

Keep video, payment and messaging external initially. Deep integrations are separate adapters, not core domain logic.

### Phase 3 Matching and monetisation experiments

After the product has evidence of useful sessions and mentor supply:

- rules-based ranking first;
- optional embeddings as a comparison, not as the only matcher;
- fallback credit experiment;
- sponsor or university funding path;
- cohort analytics and repeat-use reports.

## Recommended stack for the first real application

This is a recommendation, not a commitment. The engineering lead may choose a different stack if the team has stronger expertise.

- TypeScript monorepo.
- Next.js App Router for the web application and thin server endpoints.
- PostgreSQL as the source of truth.
- Supabase only if hosted or self-hosted Auth, Postgres, Storage and local development reduce team effort; keep application code portable to ordinary PostgreSQL.
- Zod for request validation and shared schemas.
- Playwright for end-to-end flows.
- Vitest for domain logic and decision rules.
- Docker Compose for local development.
- OpenTelemetry-compatible instrumentation from the first deployed service.

Alternative: a Python FastAPI service is reasonable if the team's strongest skills are Python and data science. Do not create both a Node backend and a Python backend before there is a concrete need.

## Domain model

Minimum entities:

- `Participant`: anonymised ID, role, consent status, campus, year, status.
- `SkillEvidence`: skill category, proof type, proof reference, verification state.
- `LearnerRequest`: task description, category, what was tried, deadline, preferred window, status.
- `MentorOffer`: mentor, eligible skills, availability, offer status.
- `Match`: request, mentor, match score/reason, proposed slot, accepted timestamp, status.
- `Session`: match, start/end timestamps, template version, completion state.
- `Feedback`: usefulness, trust, unblocked score, free text, safety flag.
- `ExperimentEvent`: experiment ID, actor, event name, timestamp, metadata.
- `Decision`: hypothesis, threshold, observed result, action and owner.

Do not store sensitive data that is not needed for the experiment. Separate PII from experiment IDs where possible.

## State machines

### Learner request

`draft → submitted → eligible → matching → matched → session_scheduled → completed`

Terminal or exception states: `ineligible`, `expired`, `cancelled`, `no_match`, `no_show`.

### Mentor offer

`invited → viewed → accepted → slot_proposed → confirmed → completed`

Exception states: `declined`, `no_reply`, `expired`, `withdrawn`.

Every transition should record actor, timestamp, source and reason code.

## Matching design

### First matcher

Use explicit rules and human review:

1. task category compatibility;
2. required skill evidence;
3. deadline and availability overlap;
4. mentor capacity;
5. no conflict or close-friend exclusion;
6. language and time zone.

Return the reasons for a suggestion. A mentor or operator must be able to reject a suggestion and record why.

### Later matcher

Compare a rules-based baseline with optional text or embedding similarity. Store both the recommendation and the final human decision. Never let an embedding score become a hidden eligibility decision.

## API boundaries

Keep external integrations behind adapters:

- `MessagingGateway`: Telegram or another channel.
- `VideoGateway`: Google Meet or Jitsi.
- `IdentityProvider`: Supabase Auth, Keycloak or another OIDC provider.
- `PaymentGateway`: deliberately disabled in the first cycle.
- `AnalyticsSink`: event ledger and OpenTelemetry.

The core domain should not import Telegram, Meet or a payment SDK directly.

## Security and trust

- Least-privilege access for operators.
- Verify mentor competence before showing the competence card.
- Separate participant identity from experiment reporting IDs.
- Record consent and withdrawal.
- Add report/block/safety escalation before public growth.
- No direct contact disclosure until a match is accepted.
- Rate-limit intake and messaging.
- Log administrative changes.

## Testing strategy

- Unit tests for eligibility, matching rules, state transitions and thresholds.
- Contract tests for Telegram/forms/video adapters.
- End-to-end test: submit request → review → match → feedback.
- Replay fixture containing anonymised R1–R3-like tasks.
- Test missing data and no-reply cases explicitly.
- Test guardrail breaches and stop lines before adding features.

## Deployment and operations

Start with one environment and a documented backup. Add staging before a private pilot. Use migrations, seed data and a repeatable local setup. Monitor:

- request-to-match latency;
- failed transitions;
- notification delivery;
- event completeness;
- G1 and G2 guardrails;
- operator overrides.

Do not introduce Kubernetes, microservices or a vector database at this stage.

