# SkillSwap UX Specification (v0.1 draft)

Status: draft defaults, to be edited by the team. Written so that a human designer or a coding agent can build from it without inventing product decisions.

Evidence labels follow the project: `R` respondent evidence (R1–R3 interviews), `S` published source, `P` peer feedback, `H` hypothesis. Anything marked `H` is an assumption, not a finding.

## 0. How to use this document

1. The team edits sections 2, 8 and 13 first. They hold the decisions only humans can make (audience, voice, open questions).
2. Section 5 and 6 are the build spec: screens, states, events.
3. After this, write `PRODUCT.md` and `DESIGN.md` for the design skill (see section 14), then prompt the coding agent **one screen at a time**, always pointing at this file.
4. Do not let the agent invent screens, fields, copy or events that are not here. If something is missing, add it here first.

## 1. Scope

### What this front end is

The SkillSwap web platform: a mobile-first web app and the team's main product surface. It covers account access, learner requests, mentor discovery, mentor briefs and responses, sessions, and post-session feedback. Matching and skill verification are still done by a human operator behind the scenes; the platform makes that work reliable instead of replacing it. The team builds it now and does not wait for experiment results.

### What it is not (carried from A6 scope)

- No payments or paid credits.
- No AI or embedding matching.
- Public student profiles and people search are approved product direction. Profile fields, discoverability, moderation, reporting/blocking, and privacy controls still need a detailed screen/data spec before implementation. No social graph, feed, follows or likes.
- No in-app video, chat or calendar. Google Meet and Telegram stay external.
- No open marketplace for non-students.
- No native mobile app.

### Account decision (2026-10-23)

The user superseded the original no-account-only direction: accounts are the primary workspace path; a single account can switch between learner and mentor roles; the first audience is students in Almaty and Astana; public profiles and search are wanted. Better Auth with the existing PostgreSQL/Drizzle database is selected. The original no-account request/private-link flow remains available during transition. The account-to-anonymised-participant mapping and public-profile privacy/moderation rules are not yet specified.

### What it keeps from the A6 validation work

The team decided the platform comes first, so experiment gating does not block the build. Two cheap things stay because they are hard to add later:

- Every meaningful action writes an event (section 7). The front end never writes contact data to events.
- Every brief and session template carries a `template_version`, recorded with the event, so results can still be compared across versions.

One caution for later analysis: if the web brief page (M2) is used in E1, an E1 result describes the page plus the structure together, not the structure alone. State that in any report.

## 2. Users and context

| User     | Situation                                                                                                                                                                                                          | Evidence  | Needs from the UI                                                                                                                                                          |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Learner  | University student in Almaty or Astana, stuck on a specific STEM or creative-software task, deadline within 14 days, already tried a free tool. Probably on a phone, arriving from a Telegram chat link, stressed. | R1, R2    | Use the account workspace to discover peers or request help. The legacy no-account request route remains during transition. Know quickly what happens next and when. Trust the person they meet. |
| Mentor   | Student (years 2–4 preferred) with a verifiable skill. Being asked by someone they do not know, probably between classes, probably on a phone.                                                                     | R2, R3, H | Understand the task in 30 seconds. Say yes with a proposed time, or say no with a reason, in one or two taps. Feel safe.                                                   |
| Operator | A team member doing eligibility, matching and logging manually.                                                                                                                                                    | H         | Not in this front end. A separate internal tool (Django admin is the current candidate). Listed here only so learner and mentor screens produce data the operator can use. |

Key observations to design against:

- Informal peer sessions felt awkward and unstructured; competence alone was not enough (`R3`). So the session needs visible structure, and the mentor needs a visible competence signal.
- Peer teaching is already socially acceptable when trust and reciprocity exist (`R2`). So reciprocity (what the learner can give back) should be visible to the mentor.
- Free tools are tried first and fail on exact context (`R1`). So the request form must capture the exact task and what was already tried, not just a category.
- The riskiest assumption is mentor acceptance of unfamiliar learners (`A6-H02`). The mentor flow gets design priority over the learner flow.

## 3. Design principles

1. **Account-based workspace, with a legacy low-friction path.** Full workspace features require a real account; the existing request form and issued private links remain usable without accounts during transition. (`H`: whether both paths should remain long-term is unvalidated.)
2. **One screen, one main action.** Each screen has a single obvious primary button.
3. **Mentor time is the scarce resource.** Brief screens are short, scannable, and answerable on a phone in a minute.
4. **Say what happens next, with times.** Every screen ends with what will happen, who does it, and by when.
5. **Trust is content, not decoration.** Competence, proof, time box, no-show rule and contact rules are shown as plain facts, not badges and stars.
6. **Never promise what is manual.** The service is concierge. Copy says "we will match you" and states real time windows, never "instant" or "AI-powered".
7. **Plain and specific.** Real task language, real times in Kazakhstan local time with the zone shown. No marketing voice.
8. **Every state is designed.** Empty, loading, error, expired, declined, no-match, no-show. Not afterthoughts.

## 4. Information architecture

The account workspace has global navigation and public student discovery. Token pages remain focused, have no global navigation, and expose only the specific request, brief, session or report reached by that private link. Profile fields, moderation and privacy controls for discovery require a separate spec before implementation.

```
/                      Entry (short explainer + one action)
/signup                Account creation and initial role selection
/login                 Email/password sign-in
/forgot-password       Generic password-reset request
/reset-password        Set a new password from an expiring email token
/prototype             Account workspace concept (sample data; mutations not persisted)
/request               Learner request (form)
/request/:token        Learner status page (waiting, matched, session, rating)
/mentor/join           Mentor sign-up + proof (form)
/brief/:token          Mentor brief: read, propose slot, or decline
/session/:token        Session page: template, Meet link, time box
/rate/:token           Post-session rating
/report/:token         Report a problem (always reachable from any token page)
/privacy               Consent and data handling text
```

Tokens are unguessable, single-person, and expire. Expired links show a clear page (section 6, X1), never a blank error.

## 5. Screen inventory

| ID  | Screen                  | Role    | One primary action | Notes                                               |
| --- | ----------------------- | ------- | ------------------ | --------------------------------------------------- |
| E0  | Entry                   | learner | Request a session  | Also a quiet link "I can help others".              |
| L1  | Request form            | learner | Submit request     | Target: unaided in five minutes or less (`A6-H03`). |
| L2  | Request status: waiting | learner | none (read)        | Shows 24 hour expectation and what is happening.    |
| L3  | Request status: matched | learner | Confirm slot       | Shows mentor competence card and proposed time.     |
| L4  | Session page            | both    | Open Google Meet   | Template, time box, rules.                          |
| L5  | Rating                  | learner | Submit rating      | Defines "useful session" for A6.                    |
| M1  | Mentor join             | mentor  | Submit             | Skill category, proof, availability, consent.       |
| M2  | Mentor brief            | mentor  | Propose a time     | Highest-risk screen (`A6-H02`). Test it early.      |
| M3  | Mentor confirmation     | mentor  | none               | What happens next.                                  |
| X1  | Expired or invalid link | any     | Contact the team   |                                                     |
| X2  | Report a problem        | any     | Send report        | Safety path, always reachable.                      |
| X3  | Privacy and consent     | any     | none               | Text needs review before pilot.                     |

### Account-flow screen inventory (added 2026-10-23)

| ID | Screen | States / behavior |
| --- | --- | --- |
| AUTH-1 | Create account | Inline validation, request pending/error, verification email sent; selected learner/mentor role is stored as active workspace role. |
| AUTH-2 | Sign in | Pending, invalid credentials, email not verified, success to workspace. |
| AUTH-3 | Password recovery | Generic reset-request success, provider/configuration error. |
| AUTH-4 | Set new password | Missing/invalid/expired token, mismatch, pending, success back to sign in. |

Better Auth owns credentials, password hashing, verification tokens and sessions. Resend delivers email. Auth account email is separate from `participant_contacts` and is never copied to events. `account_participants` maps an authenticated user ID to one anonymised participant ID per role (`learner` or `mentor`); the account ID is never copied to requests, contacts, or events. A single account may therefore map to both role-specific participant records.

## 6. Screen specs (text wireframes)

Copy in angle brackets is placeholder text for the team to rewrite in its own voice.

### E0 Entry

```
[wordmark]

Stuck on a specific task?
<Get one hour with a student who already solved it. Free.>

[ Request a session ]          <- primary

<For university students in Almaty and Astana. Tasks due within 14 days.>
<Math, programming, video editing, design tools, and similar.>

How it works (3 plain lines, no icons required)
1. <You describe the task. 5 minutes.>
2. <We find a student who has done it. Within 24 hours.>
3. <You meet on Google Meet for 45 minutes.>

Link: I can help others instead
Link: Privacy
```

States: none (static). Requirement: the page must say who it is for and what it is not (<not a course, not paid tutoring>).

### L1 Request form

Single page, no steps. Autosave draft in the browser. Fields in this order:

| Field                          | Type                                     | Rules                                                                              |
| ------------------------------ | ---------------------------------------- | ---------------------------------------------------------------------------------- |
| Task area                      | choice: STEM / creative software / other | "Other" shows a note that we may not be able to help.                              |
| What exactly are you stuck on? | long text                                | Placeholder with a concrete example. Minimum length hint, not a hard block.        |
| What did you already try?      | long text                                | Required. This is what separates the product from "ask in a chat".                 |
| Deadline                       | date                                     | Must be within 14 days. Later date shows an inline explanation, not an error wall. |
| When can you meet?             | 2–3 time windows                         | Kazakhstan local time, zone label visible.                                         |
| What can you teach back?       | short text, optional                     | Reciprocity (`R2`, `H`).                                                           |
| How should we reach you?       | Telegram username or phone               | Never shown to the mentor before a match is accepted.                              |
| Consent                        | checkbox + link to X3                    | Required. Plain language.                                                          |

Primary button: "Send request". After submit go to L2.

States:

- Loading on submit: button disabled, label changes, no double submit.
- Validation: inline, next to the field, in plain words. Do not clear the form on error.
- Ineligible (deadline too far, unsupported area): kind, specific message and what to do instead. Record `eligibility_checked`.
- Network failure: keep the draft, show retry, never lose text.
- Completion target: median time under five minutes (`A6-H03`, `H`).

### L2 Status: waiting

```
Request received.
<We are looking for a student who has solved this. You will hear from us within 24 hours.>

Your request
  Task: ...
  Deadline: ...
  Times you gave: ...

What we are doing
  <A person on our team checks your request, then asks a student who knows the topic.>

[ Cancel request ]   [ Report a problem ]
```

States:

- No match in 24 hours: honest message, what we will do next, and a clear way to cancel. The request stays open by default; there is no separate "keep waiting" action. Do not fake progress. (This is also guardrail G1 data.)
- Cancelled: confirmation, no guilt copy.
- Edit: allow editing the deadline and time windows until matched.

### L3 Status: matched

Shows the mentor competence card (section 6.1), the proposed slot, and the rules.

```
We found someone.

[ competence card ]

Proposed time: <Thu 22 Oct, 18:00 (Almaty time)>

[ Confirm this time ]
Link: <This time does not work>   -> choose another window, tell the team

What to expect
  <45 minutes on Google Meet. Come with your task open.>
  <If either person does not show up, tell us here.>
```

States: mentor changed time, learner declines time, mentor withdrew. Each needs its own copy and a path back to waiting. Contact details are revealed only after the learner confirms and the mentor has accepted.

### 6.1 Mentor competence card (shared component)

Facts only, no stars, no fake badges:

- First name or initials and year of study (what the mentor agreed to share).
- Skill area and the specific topics.
- Proof type and a plain statement, for example <Verified by the team: project file reviewed>. Only show what was actually verified.
- Experience with this kind of task, one line the mentor wrote.
- Number of completed sessions only when real data exists. Otherwise omit the field. Never show zero or placeholder ratings.

### L4 Session page

For both people, via their own links.

```
Session: <task in one line>
<Thu 22 Oct, 18:00 Almaty time. 45 minutes.>

[ Open Google Meet ]       <- primary

One-page plan
  1. <Learner shows the task and what they tried. 5 min>
  2. <Mentor asks 2 questions. 5 min>
  3. <Work through it together. 30 min>
  4. <Learner says back what they can now do. 5 min>

Rules
  <Be on time. If you cannot come, say so here as early as you can.>
  <Do not share personal information you are not comfortable sharing.>

[ I cannot make it ]   [ Report a problem ]
```

The template is versioned (`template_version`). The structured template is the thing under test in `A6-H04` (unfamiliar pairs finish unaided). Do not add chat or video to this page.

### L5 Rating

Shown within two hours of the session (A6 E3). Three inputs only:

1. "Did this unblock you?" 1–5 scale, labelled endpoints.
2. "In one line, what can you do now that you could not before?" short text. Required for a session to count as useful.
3. "How much did you trust this person?" 1–5.

Plus an optional "Something was not okay" link that goes to X2.

States: skipped (record as missing, never as zero), partially submitted (save any answered fields and mark unanswered fields `incomplete`; show saved answers and allow only unanswered fields to be completed), partially submitted after the window (preserve saved answers and record unanswered fields as `no_reply`), already submitted (show thank-you, no resubmit). A server-side expiry job records `no_reply` for unanswered fields after the two-hour window; opening a rating link must not itself mutate feedback.

### M1 Mentor join

Fields: name or initials, skill categories and specific topics, proof (link or file reference, only what is needed), availability windows (Kazakhstan time), preferred contact, consent. Must state clearly what is shown to learners and when. Proof handling details are an open question.

### M2 Mentor brief (highest-risk screen)

This is the most important screen in the product. It must be readable on a phone in about 30 seconds.

```
<A student needs help with:>
<Task, one or two lines the learner wrote>

Already tried     <what they tried, max ~3 lines>
Deadline          <date>
Time box          45 minutes, one session
They can give back <skill or "not specified">
No-show rule      <plain statement>

[ Propose a time ]            <- primary
[ I can not help with this ]  -> reason picker (required, one tap)
```

Decline reasons (closed list, becomes `reason_code`): not my skill, no time before deadline, task unclear, not comfortable with an unfamiliar person, other. A free text field is optional and never required.

"Propose a time" shows the learner's windows as tap targets and an option to suggest another. Responding within 48 hours counts as acceptance for `A6-H02`. Show the response window explicitly: <Please answer by <date, time>>.

States:

- Not yet answered, including after a reminder. A reminder does not create a separate participant-facing state or copy.
- Already answered (show what was sent, allow change before confirmation). A mentor may change a declined brief back to `slot_proposed`, and may withdraw a `slot_proposed` brief before confirmation. After learner confirmation M2 is read-only.
- Learner cancelled (clear message, thank the mentor).
- Brief expired.

### M3 Mentor confirmation

What was sent, what happens next, who to contact, and how to withdraw. No upsell, no gamification.

### X1 Expired or invalid link

<This link no longer works.> What can be done: contact the team through the channel they came from. Never show a generic server error.

### X2 Report a problem

Reachable from every token page. Choose a category, free text optional, submit. States the response commitment honestly, for example <A person on our team reads this. We will reply within <X hours>>, with X set by the team. Writes `safety_flag`.

### X3 Privacy and consent

Plain-language page: what is collected, who sees it, when contact details are shared, how to withdraw. The legal wording is **not** drafted here and needs review before real pilot use.

## 7. Event mapping

Event names come from `docs/DATA_DICTIONARY.md`. The front end sends events through a server endpoint; the server assigns the anonymised `participant_id`. No contact data in any event field.

| Screen / action                   | Event                                 | Notes                                                 |
| --------------------------------- | ------------------------------------- | ----------------------------------------------------- |
| L1 submit                         | `request_submitted`                   | includes task category, source channel, `data_origin` |
| Eligibility result                | `eligibility_checked`                 | reason code if ineligible                             |
| M2 opened                         | `mentor_viewed`                       |                                                       |
| M2 propose time                   | `mentor_accepted` and `slot_proposed` | timestamp is the acceptance time                      |
| M2 decline                        | `decline_reason`                      | `reason_code` required                                |
| M2 no answer in window            | `mentor_no_reply`                     | written by the system                                 |
| L3 confirm                        | `match_accepted`                      |                                                       |
| L4 session starts                 | `session_started`                     |                                                       |
| Session ends                      | `session_completed`                   | with duration                                         |
| L4 "cannot make it", no one shows | `no_show`                             | `reason_code` required                                |
| L5 usefulness                     | `usefulness_submitted`                |                                                       |
| L5 trust                          | `trust_submitted`                     |                                                       |
| X2 report                         | `safety_flag`                         | `reason_code` required                                |
| 48 hour follow-up                 | `followup_48h`                        |                                                       |

`data_origin` (real_pilot, constructed, rehearsal) must be set by the server for each cohort and must be impossible for a participant to change.

## 8. Voice and content rules

Voice: a capable older student who respects your time. Direct, warm, specific. No hype.

Rules:

- Name the real thing: <task>, <deadline>, <45 minutes>. Not "your learning journey".
- Say what happens next on every screen.
- Times always carry the zone label.
- Do not use: unlock your potential, supercharge, seamless, AI-powered, revolutionary, empower, game-changing, community of learners.
- Never promise "instant". The service is manual and has stated time windows.
- Sentence case. Short sentences. Buttons are verbs: "Send request", "Propose a time".
- Error text says what happened and what to do, with no blame.
- Interface strings live in one file keyed by id, so Russian and Kazakh can be added later (`H`: the audience may prefer them; see open questions).

The team should rewrite all angle-bracket copy in its own words before building. Placeholder copy is for structure, not for shipping.

## 9. Trust and safety UX

- Contact details are shared only after both sides have accepted.
- Show the no-show rule and contact rule before the person commits.
- Report is always one tap away on every token page.
- Operators can correct a bad match, so every learner and mentor page must have a way to say "this is wrong".
- No ratings or reviews are shown publicly. Competence cards contain only verified facts.
- Meeting a stranger online is a real safety risk. Define the escalation process and the person who owns it **before** E3.

## 10. Accessibility and performance

- Mobile first, design at 360 px wide, then widen. Single column.
- Tap targets at least 44 by 44 px. Primary action reachable by thumb.
- Works on a slow connection; first screen is light and usable before heavy assets load.
- Text contrast meets WCAG AA. Never convey meaning by color alone.
- Full keyboard use and visible focus states on desktop.
- Forms autosave; no loss of typed text on error or refresh.
- Account required for the main workspace; the legacy request/private-link path remains available during transition. No required install.
- Dates and times unambiguous (weekday, date, time, zone).

## 11. Usability test plan

Run on the clickable or coded flow before E3 uses it.

| Question                                                            | Task                                           | Pass                                                                    |
| ------------------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------- |
| `A6-H03` Can a learner write a usable request unaided?              | Submit a request for a realistic prepared task | At least 4 of 5 testers finish unaided in five minutes or less          |
| Can a mentor decide in a minute?                                    | Read the brief, propose a time or decline      | At least 4 of 5 decide within about one minute and can restate the task |
| `A6-H04` Can an unfamiliar pair finish a templated session unaided? | Run L4 template                                | Observed in E3, not here                                                |

Five testers per role is a convenience sample. Report counts, not percentages. Record where people hesitate, what they misread and which words they stumble on.

## 12. Non-goals and anti-patterns for the build

For the coding agent and the team:

- No hero with gradient blobs, generic stock icons, emoji as decoration, or three identical feature cards.
- No default component-library look left unchanged (default radius, default shadows, default fonts).
- No fake social proof, testimonials, counters, or "join 1,000 students".
- No dashboards, no sidebars, no profile pages.
- No animation that exists only to look modern.
- No copy invented by the agent. Use the strings file.
- No new fields, screens or events that are not in this document.

## 13. Open questions (team decisions)

1. **UI language.** English only for the pilot, or Russian and Kazakh from the start? Strings are keyed so this can change.
2. **Web or Telegram Mini App.** Web by link is the default here. A Mini App fits the Telegram channel and removes friction (`H`), but locks the first version to one platform's behavior.
3. **Learner information shown to mentors.** The brief shows task, what was tried, deadline and give-back. Should anything about the learner (year, faculty) be shown? Privacy versus trust.
4. **Mentor proof.** What kinds of proof are accepted, who verifies them, and how long are proof links kept?
5. **Give-back.** Is reciprocity actually carried out and measured in E3, or only asked about? This decides whether the data model needs a give-back field.
6. **`template_version` field.** Add it to the event schema before E1.
7. **Consent and privacy wording** and review by someone qualified for Kazakhstan personal-data rules.
8. **Safety escalation owner** and response time.
9. **Hosting and token handling.** Where it runs, how long tokens live, how links are delivered.
10. **Operator tool.** Django admin or something else. Out of scope here but it consumes the same events.
11. **Brand.** Name, wordmark, any existing colors the team already uses.

## 14. Build order

The platform is built screen by screen with a coding agent. The sequence and the prompts live in `PROMPTS.md`; the rules the agent follows live in `AGENTS.md`, `PRODUCT.md` and `DESIGN.md`.

1. Bootstrap, design tokens and primitives, data layer with the event writer and tokens.
2. M2 mentor brief, then L1 request form (these two carry the most risk).
3. L2/L3 status, L4 session page, L5 rating.
4. M1 mentor join, entry, privacy, report and expired-link pages.
5. Minimal operator tooling to create briefs and links.
6. Usability test (section 11) on M2 and L1 with real students, then iterate.

Before any real student uses it: consent text reviewed, safety escalation owner named, and the open questions in section 13 answered.
