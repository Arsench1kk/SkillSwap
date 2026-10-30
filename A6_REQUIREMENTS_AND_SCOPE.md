# SkillSwap Assignment 6 Requirements and Scope

## Purpose

Assignment 6 asks the team to define an MVP boundary and validation plan. It is not a request to build a complete production application. The central question is whether SkillSwap can create a useful peer session with an unfamiliar mentor before investing in automation.

## Source files

- `PA_Assignment_5_Revised...` and Assignment 5 deck: strategic context.
- `SkillSwap_A6_Evidence_Appendix.docx`: detailed A6 evidence, hypotheses, experiments, owners and thresholds.
- `Lab6 (1).md`: 20-slide A6 plan and presentation content.

The assignment brief is instruction, not evidence. The team's interviews and observed pilot data are evidence. Statements marked `H` are hypotheses.

## Product decision carried forward

- Segment: university students in Almaty and Astana with an urgent STEM or creative-software task due within 14 days.
- JTBD: connect me with a verified peer who solved my exact task, for free.
- Reason to switch: a trusted peer outside the learner's immediate circle, a structured session and free barter by default.
- Business model: free barter first; a 1,500 KZT fallback credit only when no suitable free swap exists. This credit is not launched or validated.
- Selected initiatives: I1 Concierge Midterm Swap Week and I2 Structured trust and session package.

## MVP boundary

The MVP is a concierge service, not an app:

- Telegram for communication.
- Google Forms for learner requests, mentor sign-up and feedback.
- Google Sheets for eligibility, matching, timestamps, status and metrics.
- Google Meet for sessions.
- Manual eligibility checks, proof verification, matching, reminders and logging.

The learner receives a matched peer session, a mentor competence card, a one-page session template and a three-question follow-up.

## Explicit exclusions

Do not build these in the first validation cycle:

- AI embedding matching.
- Payments or paid credits.
- Open marketplace for non-students.
- Public profiles and social graph.
- In-app video or calendar infrastructure.
- Full mobile application.

These exclusions are deliberate. Each would add implementation work before the team knows whether mentors accept unfamiliar learners or whether sessions create value.

## Hypothesis register

| ID | Risk | Hypothesis | Priority |
|---|---|---|---|
| A6-H01 | Desirability | Learners with a stuck task request a free match within 24 hours. | High |
| A6-H02 | Desirability | Mentors accept structured briefs from unfamiliar learners. | Highest |
| A6-H03 | Usability | Learners write a usable request unaided in five minutes or less. | Medium |
| A6-H04 | Usability | Unfamiliar pairs finish a templated session unaided. | Medium |
| A6-H05 | Feasibility | The team matches a qualified mentor within 24 hours using no more than 15 minutes of effort per case. | High |
| A6-H06 | Feasibility | Embedding-based matching ranks a suitable mentor in the top three. | Deferred |
| A6-H07 | Viability | An unmatched learner reserves a 1,500 KZT fallback credit. | Medium but deferred |
| A6-H08 | Viability | At least two chat or club administrators agree to post the pilot call. | Medium |

## Success criteria

- E1 support: structured brief accepted by at least 5 of 10 mentors and at least two more acceptances than the plain brief.
- E1 iterate: at least 5 acceptances but the gap is under two; simplify the brief and inspect decline reasons.
- E1 weaken: at most 2 of 10 accept; reconsider free mentor supply and incentives.
- E2 pass: at least 5 of 8 constructed cases matched within 24 hours and at most 15 minutes per case.
- E3 continue: at least 3 useful sessions, at least 50% useful, and usefulness/trust guardrail met.
- E3 iterate: 2 of 5 useful or a guardrail breach.
- E3 reconsider: at most 1 useful session when sessions were actually held.

## Guardrails

- G1: at least 30% of eligible requests receive an accepted match within 24 hours.
- G2: at least 70% of returned ratings are non-negative and no safety flag is present.
- Missing data must be reported separately, never silently converted to zero.
- A guardrail breach overrides a superficial pass.

## What the engineering lead must not claim

- A demo is not PMF.
- A survey is not observed behaviour.
- A simulated rehearsal is not project data.
- A good defence is not customer validation.
- A target is not a baseline.
- AI matching is not required for the first experiment.
