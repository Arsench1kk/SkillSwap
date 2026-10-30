# SkillSwap Context Index

Read this folder before proposing architecture or writing code.

## Current truth

SkillSwap is a peer-to-peer learning platform for university students in Almaty and Astana. Current execution direction (2026-10-19): build the private web platform first, as recorded in `docs/decisions/ADR-002-web-platform-first.md`; the app is at P0 bootstrap. This is a product sequencing choice, not evidence that demand, mentor acceptance or session value has been validated.

The A6 materials remain the source of truth for experiment hypotheses, scope, evidence limits and safety requirements. Matching and verification remain manual; payments, public discovery and AI matching remain out of scope. Older phased plans that defer the app until after experiments are historical recommendations superseded for build order, not evidence that the risks disappeared.

## Reading order

1. `AGENTS.md` — active repository and implementation rules.
2. `PRODUCT.md` and `DESIGN.md` — product truth and visual-system drafts; preserve TEAM questions for humans.
3. `docs/UX_SPEC.md`, `docs/DATA_DICTIONARY.md`, `docs/RESOURCES.md` and `docs/PROMPTS.md` — active web specification, event schema, reuse guide and build order.
4. `docs/decisions/ADR-002-web-platform-first.md` — current sequencing choice and its trade-offs.
5. `docs/DEPENDENCIES.md` — installed direct dependencies, licenses and audit note.
6. `PROJECT_CONTEXT_SKILLSWAP.md` — product history, interviews, alternatives, business model and evidence boundaries.
7. `A6_REQUIREMENTS_AND_SCOPE.md` and `A6_VALIDATION_PLAN.md` — experiment hypotheses and original validation constraints.
8. `TECHNICAL_ARCHITECTURE_PLAN.md` and `IMPLEMENTATION_ROADMAP.md` — earlier phased proposals; read with ADR-002 because implementation sequencing changed.
9. `ENGINEERING_PLAN_REVIEW.md` and `skillswap-toolkit/README.md` — experiment-toolkit findings; use for data integrity, not app implementation.
10. `AI_HANDOFF_SENIOR_ENGINEER.md` and `ASSIGNMENT_5_STRATEGY_DRAFT.md` — handoff and A5 strategy context.

## Source material

- `SkillSwap_A6_Evidence_Appendix.docx` — A6 evidence appendix received from the user.
- `Lab6 (1).md` — A6 20-slide plan and requirements.
- `ASSIGNMENT_5_STRATEGY_DRAFT.md` — detailed A5 strategic narrative.
- `PROJECT_CONTEXT_SKILLSWAP.md` — historical context from Assignments 3–5.
- `skillswap-toolkit/` — source archive supplied on 2026-10-19; contains experiment scripts, tests and duplicated context, not the production SkillSwap app.
- `docs/context/` — A5/A6 technical context snapshots included with the web pack; note that ADR-002 changes implementation sequencing.

## Critical warning

Do not describe A6 rehearsal or simulated practice data as real pilot data. Do not invent customer demand, willingness to pay, mentor acceptance or baselines. Keep `R`, `S`, `P` and `H` labels intact.

Do not treat draft toolkit thresholds as frozen: `frozen_at` is null and the E1/E2 rules need reconciliation with the A6 source before pilot data is collected.

