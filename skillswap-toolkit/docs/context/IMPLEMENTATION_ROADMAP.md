# SkillSwap Implementation Roadmap

## North star for engineering

The team should earn the right to build a marketplace. The order is:

`mentor acceptance → manual matching → useful session → repeat value → automation → funding`

Do not invert this order by starting with AI matching, payments or a polished app.

## Workstream 0 Repository and governance

### Deliverables

- TypeScript or Python decision recorded in an ADR.
- README with local setup and experiment context.
- `.env.example` with no secrets.
- Database migration strategy.
- Data dictionary for A6 events.
- License inventory.
- Issue labels: `experiment`, `domain`, `security`, `observability`, `deferred`.

### Done when

A new engineer can understand the experiment, run the local test environment and identify what is deliberately out of scope.

## Workstream 1 Experiment instrumentation

### Deliverables

- Event names matching A6: request submitted, brief sent, mentor viewed, mentor accepted, slot proposed, match accepted, session started, session completed, usefulness submitted, trust submitted, no-show and decline reason.
- Stable anonymised participant IDs.
- Timestamp and timezone policy.
- CSV/JSON export and a repeatable summary query.
- G1 and G2 calculations with missing data visible.

### Done when

The team can reconstruct one request from intake to feedback without using memory or editing history by hand.

## Workstream 2 Concierge support

Do not automate the entire workflow. Build only small helpers that remove transcription error:

- request validation script;
- duplicate detection;
- match queue view;
- reminder templates;
- event import from forms/sheets;
- threshold report.

### Done when

An operator can run E1, E2 and E3 with less manual confusion, while every decision remains auditable.

## Workstream 3 Internal operations tool

Start after E1 supports mentor acceptance and E2 passes operational feasibility.

### Vertical slice

1. Operator signs in.
2. Operator views a learner request.
3. Operator verifies eligibility and mentor evidence.
4. Operator proposes a match and records reason.
5. Operator records acceptance and session status.
6. Operator sees feedback and guardrail impact.

Do not build a general dashboard before this slice works.

## Workstream 4 Private pilot app

Only after at least one real learner cohort shows useful completion:

- learner request form;
- mentor offer and availability;
- operator review;
- match acceptance;
- structured session template;
- feedback;
- basic cohort report.

Keep the first app private and invite-only. Keep manual review in the loop.

## Workstream 5 Matching evolution

### Baseline

Rules-based matching with explicit reasons and human override.

### Experiment

Compare rules ranking with pgvector or another similarity method using held-out requests. Evaluate:

- top-1 and top-3 suitable mentor rate;
- accepted match rate;
- time to match;
- useful session rate;
- false positives and unsafe recommendations.

Do not evaluate only offline similarity. A mathematically close profile is not necessarily a willing or available mentor.

## Workstream 6 Funding and payments

Start only after free useful sessions and repeat value are visible.

- Add a payment abstraction, not payment-specific domain logic.
- Use test mode and an explicit refund/no-show policy.
- Separate payer, mentor and platform ledger entries.
- Treat 1,500 KZT as a hypothesis.
- Compare paid fallback with sponsor or university funding.

## Suggested issue order

1. Add project README and decision log.
2. Define A6 event schema and anonymised IDs.
3. Implement E1/E2/E3 threshold calculator with fixtures.
4. Import and validate concierge CSV exports.
5. Build operator request queue.
6. Add audit log and role permissions.
7. Build private learner request flow.
8. Add transparent rules-based matching.
9. Add structured session and feedback flow.
10. Run a new cohort and decide whether to invest in automation.

## Definition of done for any feature

- It names the hypothesis or operational failure it addresses.
- It has a user or operator scenario.
- It records relevant events.
- It has tests for normal, missing and negative cases.
- It has a manual fallback.
- It documents privacy and access implications.
- It does not silently change an A6 threshold.
- It has an explicit rollback or removal path.

