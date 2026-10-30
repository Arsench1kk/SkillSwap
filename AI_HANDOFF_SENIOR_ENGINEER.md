# SkillSwap AI Handoff for Senior Software Engineer

## How to use this folder

Read these files in order:

1. `PROJECT_CONTEXT_SKILLSWAP.md` — full product and evidence history.
2. `A6_REQUIREMENTS_AND_SCOPE.md` — current scope and non-negotiable constraints.
3. `A6_VALIDATION_PLAN.md` — experiments and decision rules.
4. `TECHNICAL_ARCHITECTURE_PLAN.md` — architecture direction.
5. `OPEN_SOURCE_OPTIONS.md` — reuse candidates and trade-offs.
6. `IMPLEMENTATION_ROADMAP.md` — implementation sequence.
7. `ASSIGNMENT_5_STRATEGY_DRAFT.md` — detailed A5 narrative and previous strategic model.
8. `ENGINEERING_PLAN_REVIEW.md` — critical review of the supplied toolkit and unresolved A6/code mismatches.
9. `skillswap-toolkit/README.md` and `skillswap-toolkit/docs/ENGINEERING_PLAN.md` — Phase 0 scripts and proposed later phases.

## Your role

Act as a senior software engineer and product-minded technical lead. Your responsibility is to turn evidence into a safe implementation plan and to prevent the team from building features before the critical assumptions are tested.

## Current execution status

The user selected a platform-first build sequence; the P0 scaffold is in `apps/web/`. Continue with the next prompt in `docs/PROMPTS.md`. This does not turn A6 hypotheses into evidence: matching and verification remain concierge-operated, and A6 privacy, safety and evidence-label constraints still apply. `ENGINEERING_PLAN_REVIEW.md` predates ADR-002; its code-review findings remain relevant, but its recommendation to defer the platform is superseded for sequencing.

## First response expected from the engineer

For each new task, first:

1. Confirm the active prompt/screen and acceptance criteria in `docs/PROMPTS.md`.
2. Identify the smallest safe implementation slice and any human decision that blocks it.
3. Preserve the data model and event schema needed for later experiment analysis.
4. Keep the workflow manually operable with a safe fallback.
5. Name privacy, safety, matching, supply, abuse and operational risks.
6. Record new dependencies with versions, licenses, maintenance status and removal path.
7. Report open questions and the verification performed.

## Constraints to respect

- Current execution is platform-first, but its product hypotheses remain unvalidated.
- Human matching and verification remain manual concierge operations.
- No production AI matcher before labelled outcomes exist.
- No payment launch before free usefulness is demonstrated.
- No public marketplace before safety and supply are understood.
- No invented baselines or customer demand.
- Keep R, S, P and H evidence separate.
- Preserve event timestamps, missing data and decline reasons.
- Design for manual override and rollback.
- Treat the toolkit as a Phase 0 experiment-integrity prototype, not the SkillSwap application.
- Reconcile E1 paired outcomes, E1 guardrails, E2 median-vs-average, E3 `data_origin`, and G2 denominator before using automated decisions.
- The earlier Phase 1 Django/PostgreSQL proposal is superseded by the current Next.js web-platform direction in ADR-002.

## What a good plan should answer

- Which exact assumption does each component test?
- What is the smallest vertical slice?
- What is the source of truth for requests, matches and feedback?
- How will an operator correct a bad match?
- How will the team know whether an apparent metric improvement is real value or selection bias?
- How will privacy, consent and safety be handled for student-to-student contact?
- Which open-source component is being reused, under what license, and how can it be removed?
- What will be deliberately postponed?

## Preferred engineering posture

Choose boring, observable and replaceable components. A simple PostgreSQL-backed service with transparent rules is preferable to a distributed AI architecture at this stage. Use open source to avoid rebuilding generic infrastructure, not to avoid making the product decisions that are unique to SkillSwap.

## Decision log template

For every material decision, record:

```text
Decision:
Date:
Context:
Options considered:
Chosen option:
Why now:
Hypothesis or evidence linked:
Trade-offs:
What would invalidate it:
Rollback or replacement path:
Owner:
```

## Current open questions

- Who can provide the first two real pilot channels?
- Are mentor proof items safe and practical to verify?
- What exact consent language will be used before sharing contact details?
- Which task categories have enough potential mentors?
- Does the team need a private operations tool before E1, or are forms and sheets sufficient?
- Which framework does the team already know well enough to maintain?
- What is the acceptable safety escalation process?
- When will a second cohort be run to check repeat value?

