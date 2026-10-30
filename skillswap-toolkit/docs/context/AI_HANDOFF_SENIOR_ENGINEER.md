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

## Your role

Act as a senior software engineer and product-minded technical lead. Your responsibility is to turn evidence into a safe implementation plan and to prevent the team from building features before the critical assumptions are tested.

## First response expected from the engineer

Before writing code, produce:

1. A concise architecture proposal for the current validation stage.
2. A decision about whether code is needed before E1, E2 or E3.
3. A data model and event schema that preserve experiment validity.
4. A proposed repository structure.
5. A risk list covering privacy, safety, matching, supply, abuse and operations.
6. A phased plan with milestones, owners and stop conditions.
7. An open-source reuse matrix with licenses and removal cost.
8. A list of questions that require team confirmation.

## Constraints to respect

- Current stage is pre-MVP validation.
- First delivery is manual concierge service.
- No production AI matcher before labelled outcomes exist.
- No payment launch before free usefulness is demonstrated.
- No public marketplace before safety and supply are understood.
- No invented baselines or customer demand.
- Keep R, S, P and H evidence separate.
- Preserve event timestamps, missing data and decline reasons.
- Design for manual override and rollback.

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

