# SkillSwap Assignment 6 Validation Plan

## Operating principle

Run the smallest experiment that observes the behaviour behind the riskiest assumption. A6-H02 is first because if unfamiliar mentors do not accept the request, demand and matching features do not matter.

## Fourteen day cycle

| Period | Work | Owner | Output |
|---|---|---|---|
| Days 1–2 | Freeze brief, competence card, consent language, reason codes and data sheet. Rehearse the procedure. | Team | Frozen experiment materials |
| Days 3–6 | E1 mentor acceptance offer test. | Andrey | Timestamped mentor responses and decline reasons |
| Days 4–6 | E2 operational matching POC in parallel. | Ruslan | 8-case coverage and minutes per case |
| Day 6 | Decision point DP1. | Togzhan | Open, narrow or pause E3 |
| Days 7–9 | Recruit eligible learners and run E3 concierge sessions. | Nurlan and Arsen | Requests, matches, sessions and ratings |
| Days 10–14 | Complete sessions, follow-ups, G1/G2 checks and decision point DP2. | Amir and team | Clean dataset and recommendation |
| Around day 37 | Optional repeat-use follow-up outside the 14-day cycle. | Andrey | 30-day return signal |

Budget: 15 team-hours and 0 KZT cash, assuming volunteers and free tools.

## E1 Mentor acceptance probe

### Question

Will an unfamiliar mentor propose a slot within 48 hours when given a structured task brief?

### Participants

- 8–10 mentors from two pilot chats or clubs.
- Years 2–4 preferred.
- At least one proof of skill.
- Exclude the project team and close friends.
- If access forces team-course participants, label the sample as convenience access.

### Method

Each mentor receives two briefs in their skill area:

- P: a plain two- or three-line chat request.
- S: task, what was already tried, deadline, 45-minute time box, give-back skill, no-show rule and competence card.

Send the second brief 24 hours later and alternate order. Disclose that the tasks are constructed from R1–R3-type problems. Do not merge rehearsal data with the main sample.

### Measure

Accept means the mentor proposes a day and time within 48 hours. Record:

- S acceptances divided by mentors who received S.
- P acceptances.
- S minus P.
- replies within 24 hours;
- explicit decline reason;
- absence/no reply separately;
- incomplete or no skill match separately.

### Decision rules

- Support: S at least 5 of 10 and at least two more than P. Run E3 unchanged.
- Iterate: S at least 5 but gap under two. Simplify the package and study decline reasons.
- Weaken: S at most 2 of 10. Reconsider free mentor supply and incentives.
- Inconclusive: S 3–4, fewer than 8 usable mentors or more than 40% no reply. Recruit for two more days and rerun once.

## E2 Operational POC

Question: can the team find a qualified, available mentor for a brief within 24 hours using at most 15 minutes per case?

- Eight constructed cases: at least three STEM and three creative-software.
- Qualified means topic match, verified proof and a free slot before the deadline.
- A second rater re-checks two cases.
- Pass at least 5 of 8 and at most 15 minutes per case.
- If 3–4 cases pass or effort is 16–25 minutes, restrict the promise to covered skills and recruit.
- If at most 2 pass or effort exceeds 25 minutes, hold E3.

E2 tests operational feasibility only. It does not prove mentor acceptance or customer value.

## E3 Concierge trial

Question: do learners with an urgent task turn a request into a useful session compared with their last stuck episode?

### Participants

- Five learners, minimum four usable cases.
- Task due within 14 days.
- STEM or creative software.
- Learner already tried a free tool.
- Exclude team members and the mentor's close friends.

### Procedure

1. Learner submits the form.
2. Team checks eligibility.
3. Team matches within 24 hours.
4. Mentor and learner complete a 45–60 minute Meet session.
5. Learner rates usefulness within two hours.
6. Team follows up at 48 hours.

### Useful session definition

- At least 30 minutes completed.
- Learner reports “unblocked” at 4 of 5 or higher.
- Learner writes one line describing what they can now do.

### Decision rules

- Continue: at least 3 useful sessions, at least 50% useful and G2 met.
- Iterate: 2 of 5 useful or G2 breach.
- Reconsider: at most 1 of 5 useful when sessions were held.
- Inconclusive: fewer than 4 usable requests or at least two no-shows.

## Data collection schema

Keep one row per event or a normalized relational equivalent. Minimum fields:

- anonymised participant ID;
- role: learner or mentor;
- task category;
- source channel;
- brief type: P or S;
- timestamp sent;
- timestamp replied;
- accepted slot;
- decline/no-reply reason;
- match timestamp;
- session start and end;
- usefulness rating;
- trust rating;
- safety flag;
- one-line outcome;
- follow-up outcome.

Do not store unnecessary personal data. Use consent language, anonymised IDs and role-based access to the sheet.

## Decision outputs

At the end of the cycle, produce:

1. Raw counts with percentages.
2. Missing data and exclusions separately.
3. E1/E2/E3 decision against frozen thresholds.
4. One decision: continue, iterate, reconsider or stop.
5. The next hypothesis to test.

