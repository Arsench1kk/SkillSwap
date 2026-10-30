# SkillSwap Project Context

## Purpose of this file

This file preserves the working context of the SkillSwap Product Analytics team project for future assignments. It separates course requirements from the team's actual evidence, decisions, assumptions and unfinished work. Assignment 6 is now the current implementation context; treat A6's manual-validation boundary as the active priority.

Last reviewed: 18 October 2026

## Project identity

- Project: SkillSwap / Skill Swap Student
- Course: Product Analytics
- Industry: EdTech / peer-to-peer learning
- Team: Togzhan (Project Lead), Amir, Nurlan, Ruslan, Andrey, Arsen Abduhalyk (Product strategy)
- Current target geography: Kazakhstan, starting with Almaty and Astana
- Core concept: an AI-assisted platform that matches people with complementary skills for structured peer-to-peer learning and skill exchange.

## Important distinction: requirements versus completed work

The assignment brief documents are instructions and assessment criteria. They are not evidence that the team completed the requested research. The submitted Assignment 3 and Assignment 4 files are the team's work and claims; interview notes and official sources are the evidence behind those claims. Claims marked `H` in the submitted work are hypotheses, not validated facts.

The following are requirements found in the briefs:

- Assignment 3 required a specific segment and initial problem, three real interviews, a Five Whys analysis, a JTBD story, a comparison of 3–4 existing alternatives including a manual or indirect option, a current customer journey, and a keep/narrow/change conclusion.
- Assignment 3 required 6–8 English presentation slides plus anonymised interview notes, sources and member contributions. AI-generated or invented interviews do not count as customer evidence.
- Assignment 4 required a short Assignment 3 recap, comparison of 4–5 real alternatives, Kazakhstan and international market scan, at least three official commercial/pricing/help sources, two task checks, 2–3 focused buying conversations, user/buyer/payer roles, market boundaries, a compact TAM/SAM/SOM, two charging models, all nine Lean Canvas blocks, P1/P2 feedback responses, two research updates, a next test, and a 15–20 slide English deck plus evidence appendix.
- Assignment 4 explicitly says that peer feedback does not establish demand or willingness to pay, prices must not be invented, and inaccessible international products must be labelled as benchmarks rather than available substitutes.

## Foundation from Week 2

The initial idea was an AI matching recommendation engine using skill profiles, learning goals and schedules. The proposed product features were:

1. AI matching of complementary skills.
2. A skill-credit or time-bank mechanism.
3. In-app scheduling and video-call setup.
4. Ratings/reviews to support trust.

The team selected SkillSwap over an AI Exam Prep Bot because it appeared to have stronger social value, wider applicability and a clear cost-saving story. The early pitch described students and self-learners as needing tutoring, skill enhancement or language practice frequently, while professional tutoring was financially difficult.

The Week 2 RACI was:

| Workstream | Responsible and Accountable | Consulted |
|---|---|---|
| Business strategy and pitch deck | Togzhan | Amir, Ruslan |
| AI matching engine and product specs | Amir | Nurlan, Togzhan |
| UX/UI and student journey | Nurlan | Togzhan, Andrey |
| Technical architecture and prototype | Ruslan | Amir, Andrey |
| Stakeholder research and financial model | Andrey | Togzhan, Nurlan |

Main stakeholder expectations recorded in Week 2:

- Students: fast and accurate matches, zero or low monetary cost, trust and ratings.
- Lifelong learners: easy onboarding, flexible scheduling and practical skills.
- University dean or academic advisers: engagement, safe peer learning and no additional university budget.
- Instructor or sponsor: functional prototype, market validation, clean architecture and a six-week execution plan.

## Assignment 3: customer problem and evidence

### Customer segment

University students and self-learners in Kazakhstan who become stuck on a specific task in video editing, higher mathematics, programming or languages. The useful situation is an urgent, personalised one-to-one help need, often before a deadline, rather than a need for a complete course.

### Interview evidence

Three anonymised interviews were conducted on 12 September 2026. They are early qualitative evidence, not a market-wide estimate.

| ID | Situation and alternative | Key evidence |
|---|---|---|
| R1 | After Effects project; YouTube, Gemini and general student chats | Tutorials did not match the specific project composition; Gemini gave text-based help, hit limits and lacked visual context; general chats were slow. |
| R2 | Multivariable Calculus / Math Analysis; classmates, friends and sibling | Peer teaching was free and reinforced the mentor's learning; paid tutoring was rejected as too expensive; finding advanced expertise outside the immediate circle was difficult. |
| R3 | Optimization Theory and Chinese; informal Zoom exchange and self-study | Informal sessions felt awkward and unstructured; technical knowledge did not guarantee teaching ability; visible ratings, achievements, portfolios or shared interests were needed for trust. |

### Problem evolution

The initial problem was broadly framed as expensive tutoring and lack of interactive peer exchange. After the interviews, the team narrowed it to:

> Students need specialised help when free resources fail, without paying for a tutor.

The central observed gap is context-aware help at the point of difficulty. The important friction is not simply “education is expensive”; it is the combination of task fit, speed, trust and affordability.

### JTBD

> When I am stuck on a specific task, connect me with a verified peer who solved the same problem, so I get tailored guidance for free.

### Existing alternatives from Assignment 3

- YouTube and free AI: fast, free and available, but generic and weak on unique project context.
- Friends, classmates and course chats: trusted and free, but limited by availability and the skills in the student's immediate circle.
- Informal Zoom barter: potentially free and mutually beneficial, but awkward and unstructured, with no quality signal.
- Paid private tutors: expertise and structure, but expensive and therefore unattractive for the researched student context.

### Current journey and break point

1. A specific task creates a bottleneck and frustration.
2. The student searches YouTube, ChatGPT or Gemini.
3. The generic answer fails, or the tool reaches a limit.
4. The student asks classmates or Telegram/WhatsApp groups.
5. The student either has an awkward informal peer session, patches the work, postpones it or lowers quality.

Break point: moving from generic self-service resources to a trusted, capable peer outside the student's immediate circle.

### Assignment 3 strategic conclusion

Keep the overall direction, but narrow it to verified and structured peer learning for specific task roadblocks. The preliminary value proposition was AI-powered skill exchange with verified peer mentors, zero-cost structured learning, complementary skills and trust ratings. The next assumption identified was whether ratings and session templates would make skill exchange feel safe and usable.

## Assignment 4: current competitor and business-model position

### Scenario used for comparison

A second-year university student in Almaty has a complex multivariable-calculus problem or After Effects task due in three days and needs about one hour of personalised help. YouTube and free AI did not solve the exact case. Alternatives are compared against this same job.

### Market boundary

- Customer job: get personalised one-to-one help on a specific study or skill task before a deadline.
- Segment: university students aged roughly 18–24, beginning with STEM, creative-software and language learners in Almaty and Astana.
- Geography: Kazakhstan, where the interviews were conducted and peers share courses, language and time zone.
- Included: peer skill exchange, tutor marketplaces, AI assistants and YouTube, classmates and messaging groups.
- Excluded: full courses and bootcamps, school/UNT tutoring, and international offers not verified as usable in Kazakhstan when they are only benchmarks.

### Competitor and alternative scan

The current five-option comparison is:

| Alternative | Status | What it offers | Main limitation for SkillSwap's job |
|---|---|---|---|
| Preply | Direct paid benchmark available in Kazakhstan | One-to-one tutors, reviews, trial lesson and rematch | Price, advance booking and 28-day plan; unused lessons can expire. |
| Kaspi tutor listings | Direct local alternative | Familiar local marketplace and tutor listings | Verification and quality structure are unclear; sampled prices were about 2,500–10,000 KZT per hour. |
| Tandem | Direct but language-focused | Complementary language exchange, free entry and paid Pro tier | Language-only, with limited teaching/session structure; not suitable for STEM or software tasks. |
| ChatGPT/Gemini plus YouTube | Indirect alternative | Immediate, free or low-cost generic guidance | Weak context for unique tasks, no human accountability and tool limits. |
| Classmates and Telegram/WhatsApp chats | Manual local workaround | Free, trusted and already used by students | Slow or unreliable responses; the circle may not contain the required expertise. |

Simbi, Codementor and a Russian barter service were treated as international or adjacent-market benchmarks, not proven Kazakhstan substitutes. Full courses such as Skillbox and Coursera were excluded because they address a curriculum rather than a same-week roadblock.

### Strongest current alternative and proposed reason to switch

The strongest current alternative is free AI plus classmates because it is free and immediate. Among paid options, Preply is strongest on trust but weak on affordability and commitment.

Current switching hypothesis:

> When AI gives a generic answer and nobody in the student's circle knows the topic, SkillSwap finds a verified peer outside that circle who understands the exact task, free through skill exchange and without a 28-day plan.

This is a hypothesis, not validated demand. Price alone is not a strong enough switching reason because local tutors were found at about 2,500 KZT/hour in the revised Assignment 4 research.

### Observed business models in the market

- Commission / marketplace: Preply; the learner pays for a lesson and the platform takes a tutor commission.
- Per-session local payment: Kaspi listings; the learner pays a tutor directly per hour.
- Subscription / freemium: ChatGPT and Tandem; the user pays periodically for an account or premium features.
- Usage-based benchmark: Codementor; payment per short unit of mentor time plus a fee.
- Barter: Simbi and informal peer exchange; users exchange credits or time rather than money.

The team's conclusion is that the market comparison is separate from the team's own proposed models. The target job is episodic and deadline-driven, so a monthly subscription appears mismatched unless later evidence shows regular use.

### Task checks

- Preply: search by subject, filter by price/time, compare profiles/reviews/video, book a trial and then choose a 28-day plan. Useful feature: trial/rematch lowers tutor risk. Limitation: recurring commitment for a one-off need.
- Tandem: set languages, browse partners, then text/voice/video chat. Useful feature: complementary matching. Limitation: language-only and no structured teaching session.

Opportunity identified: combine Preply-style trust tools and rematching with Tandem-style complementary matching, extend it to study and software skills, and charge only when a free swap cannot solve the need.

## Buying evidence, roles and market size

### Buying evidence status

The required new 2–3 focused buying conversations were not completed, and no university budget holder was reached. This limitation must remain explicit in future work. Payment-related conclusions are not validated.

The available Assignment 3 episodes show:

- R1, R2 and R3 selected options themselves; nobody paid in the reported episodes.
- R2 rejected tutors because of price.
- R3 stopped informal exchange because session quality and structure were weak.
- R2 also teaches friends for free, creating a contradiction: mentors may not expect payment, and learners may not pay for a credit.

Therefore, in the current model the student is user, buyer and payer. A university-sponsored model is only an untested future flow: student club proposes -> student affairs/dean approves -> university budget pays.

### TAM / SAM / SOM used in Assignment 4

- TAM: 678,100 university students in Kazakhstan, 2025/26.
- SAM: 288,100 students in Almaty and Astana using the latest city figures available to the team, 2024/25.
- SOM over 12 months: 1,500 active accounts, estimated as three partner universities x approximately 10,000 students x 5%.

The figures and years are mixed and the SOM is a labelled hypothesis. The reachable SOM is limited to universities where the team has access through campus chats and clubs. Arithmetic is recorded in the Assignment 4 appendix.

## Proposed monetisation

### Model A selected: free barter plus pay-per-session credit

- Barter is free: teaching one hour earns one credit.
- If no suitable swap exists, the learner can buy one 60-minute credit at 1,500 KZT (hypothesis) at booking.
- Proposed split: 70% mentor / 30% platform (hypothesis, informed by the observed Preply commission range).
- Included free: AI matching, session template, rating after each swap and two welcome credits.
- Credit returned after a no-show.

Why this model currently fits: the researched need occurs in bursts before deadlines, free peer help is the norm, and the learner should pay only when there is a real need and no swap partner. Main trade-off: revenue is generated only when barter fails.

### Model B: premium student subscription

- 1,490 KZT/month (hypothesis).
- Priority AI matching, unlimited requests and a verified badge.
- Fits regular learners better than one-off deadline-driven users.
- Main barrier: subscription commitment for an infrequent need; the price and premium demand are untested.

The 1,500 KZT and 1,490 KZT prices are hypotheses, not validated prices. The first is below the sampled local tutor floor of roughly 2,500 KZT/hour; the second is below the observed Tandem Pro price. Do not present either as a proven willingness-to-pay level.

## Current Lean Canvas

| Block | Current content | Evidence status |
|---|---|---|
| Problem | Free tools fail on specific tasks; tutors cost about 2,500–10,000+ KZT/hour; peer help is hard to find outside one's circle. | R1, R2, S4; partly interpretation. |
| Customer Segments | Students in Almaty and Astana; early adopters are STEM and creative students before midterms. | R1, R2 plus H. |
| Unique Value Proposition | Get unstuck with a verified peer who knows the exact task, free by swapping skills. | R1, R3 plus H. |
| Solution | AI have/want matching, session template and ratings. | H. |
| Channels | Course chats, student clubs and a Midterm Swap Week. | Existing behaviour plus H. |
| Revenue Streams | Learner pays per 60-minute credit; barter remains free; proposed 30% platform share. | H, informed by S2–S4. |
| Cost Structure | Embeddings/hosting, video and calendar APIs, moderation and campus events. | H. |
| Key Metrics | Match within 24 hours, completed swaps, repeat swaps, ratings and credits bought. | H. |
| Unfair Advantage | None established yet; a campus trust network might become one. | H. |

## Market-entry proposal and next test

The first audience is second- and third-year STEM and creative students facing October–November midterms, plus students who already like teaching peers. The first channels are faculty Telegram/WhatsApp study chats and two student clubs (IT and media). The proposed trial is “Midterm Swap Week”: sign up with skills offered and wanted, receive two welcome credits and a first match within 24 hours.

The most important next test is a concierge pilot:

- Participants: 15 students with midterms in two weeks from two course chats.
- Action: manual matching through a form; two free credits; offer an additional credit for 1,500 KZT through Kaspi.
- Observe: percentage matched within 24 hours, completed sessions, ratings, repeat usage and credits bought.
- Revise if: fewer than 30% match within 24 hours, or only 0–1 of 15 buy a credit; then test a university-sponsored or fully free model instead.

This test is designed to validate supply, matching speed, session quality and willingness to pay separately. A positive stated preference in an interview is not enough.

## What is confirmed, what is provisional and what is missing

### Better-supported current facts

- Three real anonymised interviews exist, all on 12 September 2026.
- Students use free AI/video resources and personal networks first.
- Specific-task fit, trust and session structure are recurring issues in the interview material.
- A local manual workaround and local paid tutor listings exist.
- Preply is presented as usable in Kazakhstan; prices and plan terms were recorded in the Assignment 4 sources.

### Provisional or unverified claims

- No verified Kazakhstan-based peer skill-exchange platform was found. This is a search result, not proof that none exists.
- 1,500 KZT per credit, 1,490 KZT/month and the 70/30 split are hypotheses.
- Willingness to buy a credit is unknown.
- Mentor supply outside the student's circle is unknown.
- Matching within 24 hours and the 1,500-account SOM are hypotheses.
- University sponsorship and the “no extra budget” barrier are unverified.
- The planned P1/P2 partner-team exchange did not actually occur. Assignment 4 records a team self-review instead; it must not be described later as genuine peer feedback.

### Key inconsistencies to preserve carefully

- Early materials state private tutoring is “10,000+ KZT/hour.” Revised Assignment 4 research found sampled local listings beginning around 2,500 KZT/hour. Use the revised range and explain the update; do not silently repeat the old anchor.
- The original product language says “free” and “barter-based,” while Assignment 4 adds paid fallback credits. Describe the current product as “free barter first, paid credit only when no swap exists.”
- The original target includes both students and lifelong learners. The current evidence and market-entry plan are much stronger for university students in Kazakhstan. Treat lifelong learners as a secondary/unvalidated segment unless Assignment 5 requires otherwise.

## Assignment 6 update: implementation must follow validation

Assignment 6 changes the immediate engineering priority. SkillSwap is still pre-MVP and must not begin with a full app, AI matching engine, payments or an open marketplace.

The first implementation target is a 14-day manual concierge validation cycle:

- Priority segment: Almaty and Astana university students with an urgent STEM or creative-software task due within 14 days.
- Core job: connect a learner with a verified peer who solved the exact task, for free.
- Delivery: Telegram, Google Forms, Google Sheets and Google Meet; matching, verification, reminders and logging are manual.
- Selected initiatives: I1 Concierge Midterm Swap Week and I2 Structured trust and session package.
- KR1: 30 eligible requests by week 6 `H`.
- KR2: 60% accepted match within 24 hours by week 10 `H`.
- KR3: 50% useful sessions by week 12 `H`.
- First risk: unfamiliar mentors accept structured briefs and propose a slot within 48 hours (`A6-H02`).
- E1 first test: offer test with 8–10 mentors, two briefs per mentor, structured brief versus plain chat, acceptance within 48 hours.
- E2 second test: 8 constructed cases to test whether the team can manually find a qualified mentor within 24 hours and 15 minutes of team effort.
- E3 third test: five real learners, manual match, 45–60 minute session, usefulness check within 2 hours and follow-up at 48 hours.
- No payment is taken in the first concierge cycle. Paid credits, AI embedding matching, public profiles, app video and open marketplace are excluded.

The first engineering deliverable should therefore be a safe, auditable experiment toolkit and data model, not a production marketplace. Any proposed feature must state which A6 hypothesis it tests and what decision it enables.

## Assignment 5: product strategy and differentiation

### What the brief is asking for

Assignment 5 builds on Assignment 4. It does not require a new competitor matrix, a new market-size calculation, a full Lean Canvas rebuild or another fixed round of buying interviews. The new work is strategic reasoning and measurement:

1. Define a longer-term product vision and a focused 12-week strategy.
2. Compare two genuinely different strategic directions and choose one.
3. Explain the reason to choose SkillSwap against one direct and one indirect/manual alternative.
4. Update up to three Lean Canvas blocks whose assumptions become more important.
5. Build a complete four-level Impact Map: Why, Who, How and What.
6. Choose two of four candidate initiatives and defer two, with evidence, feasibility and causal reasoning.
7. Define one Objective, three outcome-based Key Results, five product-health signals, one primary success metric and two guardrails.
8. Analyse the hypothetical signal pattern: acquisition up, engagement up, conversion unchanged, retention down and monetisation up.
9. Record A5-P1/A5-P2 feedback, two home-analysis changes or confirmations, individual contributions and individual defence notes.

Submission remains 15–20 English slides plus an evidence appendix. The presentation has a 7-minute team presentation, 4-minute opposing-team questions, 3-minute response to a new condition and a final decision statement. The assignment also has an individual component: each member must understand a causal link, ask a reasoned question and justify a response to uncertainty or changed conditions.

### Best current strategic direction to test

The most evidence-supported starting direction is:

> Focus first on university students in Almaty and Astana who face a specific STEM or creative-software roadblock before a deadline. Help them obtain a trusted, structured peer session within 24 hours through campus channels. Keep barter free and test a paid credit only when no suitable swap is available.

This direction is more feasible than a broad lifelong-learner or subscription-first strategy because the existing evidence is from students, the strongest workaround already lives in course chats, and the team's own university provides an accessible first channel. The 24-hour matching promise, credit purchase and mentor supply remain hypotheses.

### Two credible directions for the comparison

These are strategy alternatives, not two feature lists:

| Direction | Focus and basis of winning | Main benefit | Main trade-off |
|---|---|---|---|
| A: Campus-first deadline support | Student roadblocks in STEM/creative software; win through trusted matching outside the student's circle, structured sessions and free barter first. | Strong evidence fit and feasible access through university chats/clubs. | Narrow initial market; supply and willingness to pay remain unproven. |
| B: Broad recurring skill-exchange network | Students plus lifelong learners, especially regular language/skill practice; win through breadth and subscription convenience. | Larger long-term market and potentially recurring revenue. | Weak evidence outside students; direct conflict with episodic needs and uncertain subscription demand. |

Recommended provisional choice: Direction A. The acceptable trade-off is slower breadth and lower early revenue in exchange for a more testable segment, channel and customer outcome. This choice must be presented as a strategic hypothesis, not as validated product-market fit.

### Draft strategy statement

> We will focus on Kazakhstan university students who need one-time help with a specific task before a deadline, create value through fast trusted peer guidance, win against free AI plus classmates by extending the student's trusted circle with structured matching, and prioritise a campus-first free-barter model with a paid fallback credit during the next 12 weeks.

### Draft product vision

> Students should be able to overcome a difficult learning or project roadblock without being limited by money or by the skills of their immediate circle. SkillSwap should make trusted, reciprocal peer help easy to find, easy to start and safe to use.

### Differentiation logic

The current differentiator is specific rather than generic “AI”: matching a student's exact have/want skills, providing a structured session and showing trust signals. Against free AI plus YouTube, SkillSwap offers human context and accountability. Against classmates and chats, it expands the reachable pool beyond the immediate circle. Against Preply or Kaspi tutors, it offers free barter first and avoids a recurring 28-day commitment.

No durable advantage is established yet. A competitor could copy AI matching, ratings and session templates. The possible future advantage is a campus trust network with local skill supply, repeat behaviour and verified peer histories, but this is an `H` and must be earned through usage. The strategy should therefore claim a current reason to try, not a defensible moat.

### Likely Lean Canvas updates for Assignment 5

Only the most affected blocks should be updated:

1. Customer Segments: narrow the initial segment from students and self-learners to university students in Almaty/Astana, starting with STEM and creative-software students before midterms. Consequence: smaller scope but clearer channel and test cohort.
2. Unique Value Proposition: emphasise a trusted, structured peer session for an exact task within a useful time window, not just AI matching. Consequence: success must measure completed useful sessions and trust, not sign-ups alone.
3. Key Metrics / Channels: prioritise match-within-24-hours, completed swaps, repeat swaps, mentor supply and credit purchases through course chats and clubs. Consequence: a large acquisition number without successful matching is not progress.

The selected charging model should remain free barter plus pay-per-session credit unless new evidence changes it. The main value-versus-revenue conflict is that charging too early could reduce the free peer-help behaviour that creates supply. Guardrails should therefore protect successful matching, session completion and user-reported value while monetisation is tested.

### Draft Impact Map

This is a high-level model for Assignment 5, not a final product backlog.

**Why — 12-week business goal:** demonstrate a repeatable campus loop in which students can find and complete useful peer help for specific roadblocks, while testing whether paid fallback credits can support the service.

**Who — actor groups:**

- Learners with an urgent task.
- Peer mentors who can teach a relevant skill.
- Student clubs or course-chat administrators who can provide reach and trust.

**How — desired behaviour changes:**

- Learners describe a concrete task and complete a matched session instead of stopping at generic AI or an unanswered chat.
- Mentors accept and complete sessions outside their immediate friend circle because the task, time and reciprocal benefit are clear.
- Eligible learners buy a fallback credit only when barter cannot produce a suitable match, without harming free participation.

**What — four candidate initiatives:**

1. Concierge Midterm Swap Week through two course chats and two student clubs.
2. A structured session and trust package: skill evidence, availability, session template, rating and no-show handling.
3. Manual supply-building with mentor ambassadors and a targeted “teach one skill, earn one credit” campaign.
4. A paid-credit experiment through Kaspi after free matching fails.

Provisional selection: initiatives 1 and 2. Together they test reach, matching, trust and completion while remaining feasible without a fully built marketplace. Defer initiative 3 until the team sees where supply is actually missing, and treat initiative 4 as a tightly controlled experiment after the free loop works rather than the main adoption mechanism.

Weakest causal link: a visible rating/session structure will make strangers willing to exchange skills and complete a session. The observation that would weaken it is low mentor acceptance or low completion despite good matches. The next assignment should test this link first.

### Draft OKR for a 12-week period

All baselines are currently `not measured yet`; all targets below are proposed hypotheses and must not be presented as actual performance.

**Objective:** Make SkillSwap a trusted, repeatable way for students to complete specific learning roadblocks through peer help.

| Key Result | Impact and metric | Baseline | Provisional target and deadline |
|---|---|---|---|
| KR1 | Reach the priority segment and create eligible learner requests from the two pilot course channels. | Not measured yet. | 30 eligible learner requests by week 6 (`H`). |
| KR2 | Improve matching: percentage of eligible requests with an accepted peer match within 24 hours. | Not measured yet. | At least 60% by week 10 (`H`). |
| KR3 | Demonstrate delivered value: percentage of accepted matches that complete a session and report the task as meaningfully helped. | Not measured yet. | At least 50% of accepted matches by week 12 (`H`). |

These KRs are intentionally about reach, match quality and customer outcome. A feature release, number of interviews or number of clicks would not qualify as a KR. The target levels should be revised after the concierge pilot produces a baseline.

### Five product-health signals

The final appendix must define event, unit, cohort, window, numerator/denominator where relevant, direction, data source and response rule. The initial set is:

| Category | Signal to define | Management question |
|---|---|---|
| Acquisition | New eligible learner request by source channel | Are the intended students entering with a real task? |
| Engagement | Accepted match that starts a structured session | Are matched users taking the valuable action? |
| Conversion | Eligible request that becomes a completed session within 7 days | Does the service turn a request into delivered help? |
| Retention | Pilot participant who submits or accepts another relevant request within 30 days | Do users return for value rather than one-off curiosity? |
| Monetisation | Paid fallback credit purchased per eligible unmatched request | Does use connect to sustainable funding without damaging free exchange? |

Provisional primary metric: completed useful sessions per eligible learner request. Provisional guardrails: at least 30% of eligible requests matched within 24 hours, and at least 70% of completed sessions receive a non-negative usefulness/trust rating. Both thresholds are hypotheses and require a simple rating definition before use.

The primary metric can improve without customer benefit if the team counts easy low-need sessions or manually selects highly motivated users. The matching-speed and usefulness guardrails, plus segment/channel breakdowns, should expose that problem.

### Hypothetical conflicting signals exercise

Given acquisition up, engagement up, conversion unchanged, retention down and monetisation up, two plausible explanations are:

1. The paid fallback attracts urgent users and increases revenue, but the service is failing to deliver a useful first session. Inspect first-session usefulness, no-shows, time-to-match and retention by paid/free cohort and acquisition channel.
2. A small group of high-intent students is paying repeatedly while broad campaign traffic is low quality or one-off. Inspect cohort size, mentor supply, repeat usage and revenue concentration by channel and segment.

What remains unknown is whether retention fell because of poor product value, resolved one-time needs, insufficient future tasks or a supply problem. Overall metric movement cannot prove the cause.

Provisional action: limit the paid-credit initiative while inspecting completed-session usefulness and cohort retention; continue the acquisition and structured-session pilot only where the guardrails hold. Reconsider the wider strategy if fewer than 30% of requests can be matched within 24 hours for two consecutive pilot weeks, or if paid users have materially lower usefulness/retention than free users. These are proposed decision rules, not observed results.

## Source inventory supplied for this project

Primary project files reviewed:

- `/Users/arsenabduhalyk/Downloads/PA_Assignment_3_Customer_Problem_Existing_Alternatives_EN.docx` — Assignment 3 brief.
- `/Users/arsenabduhalyk/Downloads/PA_Assignment_3_Customer_Problem_Existing_Alternatives.docx` — duplicate Assignment 3 brief.
- `/Users/arsenabduhalyk/Downloads/APPENDIX.pdf` — Assignment 3 anonymised interview notes, contributions and evidence log.
- `/Users/arsenabduhalyk/Downloads/SkillSwap_Customer_Problem_and_Existing_Alternatives_Analysis.pdf` — Assignment 3 submitted presentation.
- `/Users/arsenabduhalyk/Downloads/PA_Assignment_4_Revised_Competitor_Business_Model.docx` — Assignment 4 brief and rubric.
- `/Users/arsenabduhalyk/Downloads/SkillSwap_Assignment4_Competitor_Business_Model.docx` — Assignment 4 written report.
- `/Users/arsenabduhalyk/Downloads/SkillSwap – Assignment 4 Competitor & Business Model.pdf` — Assignment 4 submitted presentation, including the evidence appendix reference.
- `/Users/arsenabduhalyk/Downloads/SkillSwap_Worksheet.docx` and `/Users/arsenabduhalyk/Downloads/SkillSwap_Worksheet (1).docx` — Week 2 project foundation variants.
- `/Users/arsenabduhalyk/Downloads/Week2_Homework_PA (1).docx` — Week 2 homework material.
- `/Users/arsenabduhalyk/Downloads/Peer-to-Peer Knowledge Sharing Platform.pdf` — Week 2 foundation deck.
- `/Users/arsenabduhalyk/Downloads/task_distribution.pdf` — Week 2 task distribution, team roles and presentation responsibilities.

Assignment 4 reports official source IDs S1–S16 and access date 25 September 2026. The exact URL list should be taken from the written report's Appendix A before citing sources in a new submission; do not invent or reconstruct URLs from memory.

## Working rules for Assignment 5

When Assignment 5 is provided:

1. First identify which pages are instructions, rubric or template and which are examples/submissions.
2. Check whether it builds on Assignment 3/4 or asks for new evidence. Reuse the problem, JTBD, roles, market boundary and model only where the new brief allows it.
3. Keep respondent evidence (`R`), published sources (`S`), peer/workshop input (`P`) and hypotheses (`H`) visibly separate.
4. Do not claim that the business model is validated. The biggest unresolved issue remains whether students will buy a credit and whether enough mentors will participate.
5. Prefer a narrow student-first scope unless the new assignment explicitly requires a broader segment.
6. If the new task needs current prices, competitor availability, regulations or market statistics, verify them again rather than relying on the 25 September 2026 snapshot.
7. Preserve the distinction between the free barter core and the paid fallback-credit experiment.
8. Before writing a final deliverable, compare the requested format, language, slide/page limit, evidence appendix and contribution requirements with the new rubric.

## External product-management methods to use

The following open-source methods from Anthropic's `knowledge-work-plugins` repository are part of the working process for this project:

- [`synthesize-research`](https://github.com/anthropics/knowledge-work-plugins/blob/main/product-management/skills/synthesize-research/SKILL.md): analyse each interview separately, distinguish observations/behaviours from interpretations, separate what users said from what they did, identify themes, contradictions, frequency, impact and confidence, then connect findings to decisions.
- [`metrics-review`](https://github.com/anthropics/knowledge-work-plugins/blob/main/product-management/skills/metrics-review/SKILL.md): define the primary metric, acquisition/engagement/conversion/retention/monetisation signals, baselines, targets, cohorts, segments, guardrails and decision rules. Never infer causation from aggregate movement alone.
- [`product-brainstorming`](https://github.com/anthropics/knowledge-work-plugins/blob/main/product-management/skills/product-brainstorming/SKILL.md): compare strategic bets through user, problem, solution, business, feasibility and adoption assumptions; consider second-order effects and competitor response before selecting initiatives.

Application order for Assignment 5:

1. Synthesize R1–R3 and the Assignment 4 evidence map before making strategic claims.
2. Use the synthesis to compare two directions and build the Impact Map.
3. Use metrics review to turn the selected strategy into outcome KRs, health signals, primary metric, guardrails and revision rules.
4. Use brainstorming to challenge assumptions, identify second-order effects and test what happens if a competitor copies the differentiator or willingness to pay disappears.

These methods improve product reasoning; they do not turn hypotheses into validated facts. The project's evidence labels remain `R`, `S`, `P` and `H`.

Additional methods selected for Assignment 5:

- [Gojko Adzic Impact Mapping](https://www.impactmapping.org/): preserve the original hierarchy `Why goal -> Who actors -> How impacts/behaviour changes -> What deliverables/initiatives`. An initiative must support a behaviour change; it is not itself an impact. The map should expose assumptions and connect prioritisation to the business goal.
- [strategy-mcp](https://github.com/sohaibt/strategy-mcp): use the framework sequence `JTBD -> assumption map -> competitive position -> strategic choice -> OKR -> hypothesis -> decision rule`. Its relevant concepts include assumption mapping, JTBD, competitive positioning, business-model review, pricing, OKRs, initiative scoping, hypothesis building and decision logs. It is a conceptual reference here; it is not assumed to be installed as a Codex MCP server.
- [OrchestKit OKR design](https://github.com/yonatangross/orchestkit/blob/main/plugins/ork/skills/okr-design/SKILL.md): keep the Objective qualitative and the Key Results quantitative and outcome-based. Outputs such as “build matching system” or “conduct interviews” do not qualify as KRs.
- [PostHog product analytics documentation](https://github.com/PostHog/posthog.com/tree/master/contents/docs/product-analytics): use event, funnel, retention, cohort and segmentation logic when defining health signals. For SkillSwap, retention should begin with a meaningful event such as completing a first useful peer session and return should be another relevant request or accepted session within a stated window, not a generic “active user” count.

The Impact Map and metrics review must be checked together: every selected initiative needs a behaviour change, an impact, a KR/KPI and a weakening observation. Aggregate metric movement alone is insufficient; inspect the relevant cohort, segment and channel before changing strategy.

## One-paragraph project summary

SkillSwap is a Kazakhstan-focused peer-learning platform for university students who get stuck on a specific study or creative-software task after free AI/video resources fail. Assignment 3 evidence suggests that classmates are trusted and free but limited, generic AI is fast but poorly contextualised, informal peer exchange is awkward, and paid tutoring is often too expensive. Assignment 4 therefore recommends verified AI matching, structured sessions and ratings, with free barter as the default and a pay-per-session credit as an unvalidated fallback revenue model. The next critical evidence is behavioural: can the team match students quickly, deliver a useful trusted session, attract mentors outside existing friend circles and obtain even limited real payment?
