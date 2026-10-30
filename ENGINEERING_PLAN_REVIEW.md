# SkillSwap engineering plan and toolkit review

Updated: 2026-10-19. This is an engineering review of the provided `ENGINEERING_PLAN.md`, the unpacked `skillswap-toolkit/`, and the A6 source files. It is not a claim that the pilot has run or that the product is built.

Status update: this review predates the platform-first web pack. `docs/decisions/ADR-002-web-platform-first.md` supersedes its recommendation to defer building a platform; the code and data-integrity findings below still apply to experiment reporting.

## Short answer

The plan and toolkit are useful for the **A6 validation cycle / Phase 0**, not the complete implementation of SkillSwap. They support experiment data hygiene and help calculate decisions; the current customer-facing MVP is intentionally a manually operated concierge service using Telegram, Forms, Sheets and Meet. A production marketplace, learner/mentor accounts, automated matching, payments, chat/video and mobile app are explicitly postponed until evidence supports them.

The archive contains real Python code, configuration, examples and **35 test functions**. The README says those tests pass, but they were not run as part of this review; treat that as an unverified claim. No production application or complete experiment-to-report pipeline is present.

## What is in the toolkit

- `skillswap/thresholds.py`, `report.py`: decision calculations for E1/E2/E3.
- `skillswap/validate_events.py`, `events.py`: CSV event-ledger schema and checks.
- `skillswap/anonymise.py`: salted HMAC-derived participant IDs.
- `thresholds/frozen_thresholds.json`: draft decision thresholds; `frozen_at` is still `null`.
- `templates/events_template.csv`, `examples/e1_sample.json`, tests and a data dictionary.
- `docs/context/`: copies of the existing project context; `docs/ENGINEERING_PLAN.md` and `docs/decisions/ADR-001-stack.md` add the engineering proposal.

Not included: web/mobile app, database-backed service, consent and safety forms, participant management, event-log-to-report pipeline, matching UI, payment flow, deployment, monitoring, or an approved team decision on the proposed Phase 1 stack. The README itself says report inputs currently need manual assembly.

## Findings that should be resolved before relying on automated decisions

1. **E2 statistic differs from the A6 source.** The detailed A6 plan describes a median effort threshold (and the A6 scope says no more than 15 minutes per case); the toolkit calculates `avg_minutes` and applies the 15/25-minute thresholds to the average. The median and average can lead to different decisions. Confirm the canonical rule with the team, then make code, config, documentation and tests agree. Do not freeze the current config yet.
2. **E1 rules are still open, not frozen.** A6 uses fixed counts (5/10, 2/10) and says the same proportions apply with 8–9 usable mentors. The JSON selects `threshold_mode: share`, so for 8 mentors it lowers the support threshold to 4 and weakening threshold to 1. It also has `frozen_at: null`. Record the agreed interpretation in an ADR and freeze only before collecting pilot data.
3. **E1 comparison is not truly paired in code.** A6 sends both briefs to the same mentors and compares S with P. The evaluator totals all S and P accepts independently; it does not verify that the same mentors received both briefs or calculate per-mentor paired outcomes. Missing P briefs can therefore distort the gap.
4. **E1 G1/G2 proxy checks are absent from `evaluate_e1`.** A6 defines a 24-hour response proxy and trust rating guardrail for E1, but the E1 result currently only uses acceptance totals, the S–P gap, usable count and no-reply share.
5. **E3 synthetic records can enter calculations.** `_split()` excludes only origins listed in `excluded_origins` (currently `rehearsal`). E3 should be based on real learner requests; the evaluator does not enforce `data_origin == real_pilot`, so constructed E1/E2 cases can accidentally be counted if combined in one input file.
6. **G2 denominator/meaning needs one explicit definition.** A6 says at least 70% of returned ratings are non-negative. The code computes a per-request non-negative result if any returned usefulness/trust value is above 2, and labels ratings 1–2 negative. Confirm rating scale, whether both ratings are required, whose rating counts, and the denominator before adopting this rule.
7. **Event validation is a useful first pass, not a privacy guarantee.** It checks contact-like strings only in `note`, not every free-text field, and the validator should not replace access controls, consent, retention rules or a human review of exports. The anonymiser's output retains the source contact columns, so its output is a restricted private mapping file, not an analysis-safe anonymised dataset.
8. **Plan claims need careful wording.** The A6 appendix and Lab6 source say there are no new pilot observations yet. Constructed briefs/cases, rehearsals and thresholds marked `[H]` must not be reported as actual customer evidence or outcomes.

## Source-confirmed product direction

- Current service concept: a concierge match for a real learner task, with proof-checked mentor card, structured 45–60 minute session and follow-up.
- E1: observe mentor behaviour on constructed P/S briefs; exploratory counts, not a statistical estimate.
- E2: desk-test manual matching with constructed cases; operational feasibility only.
- E3: small concierge trial with real eligible learners; useful session requires at least 30 minutes, learner unblocked rating ≥4/5, and a one-line outcome.
- H06 embedding matching and H07 paid credits are deferred; no PMF or willingness-to-pay claim is supported yet.
- Before E1: resolve thresholds, timing/DP1, brief handling, consent, data separation, safety escalation and the total effort plan.

## Recommended order of work

1. Treat the toolkit as an experiment-integrity prototype; do not start by building the marketplace.
2. Resolve the open A6 decision rules and mismatches above with the team. Keep the appendix/slide rules authoritative unless the team explicitly records a change.
3. Complete consent, safety, reason-code, access and retention procedures; run a rehearsal using `data_origin=rehearsal`.
4. Fix and review the calculators/validator; run the 35 tests and add edge-case tests before using the outputs for a decision.
5. Run E1/E2/E3 manually. Only after DP2=`continue` and a repeat cohort should the team decide whether an internal operator tool is warranted.
6. Choose a stack based on the people who will maintain it. Django/PostgreSQL is an unaccepted proposal in ADR-001, not a settled architecture.

## Material locations

- Engineering proposal: `skillswap-toolkit/docs/ENGINEERING_PLAN.md`
- Toolkit instructions: `skillswap-toolkit/README.md`
- Draft thresholds: `skillswap-toolkit/thresholds/frozen_thresholds.json`
- Decision code: `skillswap-toolkit/skillswap/thresholds.py`
- Event dictionary: `skillswap-toolkit/docs/DATA_DICTIONARY.md`
- Architecture decision (proposed): `skillswap-toolkit/docs/decisions/ADR-001-stack.md`
- A6 context bundle: `skillswap-toolkit/docs/context/`
