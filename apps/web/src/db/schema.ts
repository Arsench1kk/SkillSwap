import {
  boolean,
  check,
  customType,
  type AnyPgColumn,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { accountActiveRole, authUsers } from "./auth-schema";

export {
  accountActiveRole,
  authAccounts,
  authSessions,
  authUsers,
  authVerifications,
} from "./auth-schema";

const bytea = customType<{ data: Buffer; notNull: false; default: false }>({
  dataType() {
    return "bytea";
  },
});

export const participantRole = pgEnum("participant_role", [
  "learner",
  "mentor",
  "operator",
]);
export const participantStatus = pgEnum("participant_status", [
  "active",
  "withdrawn",
]);
export const contactType = pgEnum("contact_type", ["telegram", "phone"]);
export const skillCategory = pgEnum("skill_category", ["STEM", "creative"]);
export const skillVerificationState = pgEnum("skill_verification_state", [
  "pending",
  "verified",
  "rejected",
]);
export const learnerRequestStatus = pgEnum("learner_request_status", [
  "draft",
  "submitted",
  "eligible",
  "matching",
  "matched",
  "session_scheduled",
  "completed",
  "ineligible",
  "expired",
  "cancelled",
  "no_match",
  "no_show",
]);
export const mentorBriefStatus = pgEnum("mentor_brief_status", [
  "invited",
  "viewed",
  "accepted",
  "slot_proposed",
  "confirmed",
  "completed",
  "declined",
  "no_reply",
  "expired",
  "withdrawn",
]);
export const transitionSubject = pgEnum("transition_subject", [
  "learner_request",
  "mentor_brief",
]);
export const transitionActorType = pgEnum("transition_actor_type", [
  "participant",
  "operator",
  "system",
]);
export const matchStatus = pgEnum("match_status", [
  "proposed",
  "accepted",
  "declined",
  "withdrawn",
  "expired",
]);
export const matchHumanDecision = pgEnum("match_human_decision", [
  "pending",
  "accepted",
  "rejected",
  "modified",
]);
export const sessionCompletionState = pgEnum("session_completion_state", [
  "scheduled",
  "started",
  "completed",
  "cancelled",
  "no_show",
]);
export const missingReason = pgEnum("missing_reason", [
  "no_reply",
  "declined",
  "no_skill_match",
  "incomplete",
  "excluded",
]);
export const experimentId = pgEnum("experiment_id", ["E1", "E2", "E3"]);
export const dataOrigin = pgEnum("data_origin", [
  "real_pilot",
  "constructed",
  "rehearsal",
]);
export const briefType = pgEnum("brief_type", ["P", "S"]);
export const taskCategory = pgEnum("task_category", ["STEM", "creative"]);
export const reportCategory = pgEnum("report_category", [
  "safety_concern",
  "mentor_conduct",
  "scheduling",
  "privacy_contact",
  "other",
]);
export const eventName = pgEnum("event_name", [
  "request_submitted",
  "brief_sent",
  "mentor_viewed",
  "mentor_accepted",
  "slot_proposed",
  "match_accepted",
  "session_started",
  "session_completed",
  "usefulness_submitted",
  "trust_submitted",
  "no_show",
  "decline_reason",
  "mentor_withdrew",
  "mentor_no_reply",
  "eligibility_checked",
  "match_proposed",
  "safety_flag",
  "followup_48h",
  "request_cancelled",
  "request_updated",
  "match_declined",
  "session_cancelled",
  "mentor_join_submitted",
]);
export const tokenPurpose = pgEnum("token_purpose", [
  "learner_status",
  "mentor_brief",
  "session",
  "rating",
  "report",
]);
export const tokenSubjectType = pgEnum("token_subject_type", [
  "participant",
  "learner_request",
  "mentor_brief",
  "match",
  "session",
  "feedback",
]);

export type TimeWindow = { startUtc: string; endUtc: string };

export const participants = pgTable(
  "participants",
  {
    participantId: text("participant_id").primaryKey(),
    role: participantRole("role").notNull(),
    consentGivenAt: timestamp("consent_given_at", {
      withTimezone: true,
      mode: "date",
    }),
    consentWithdrawnAt: timestamp("consent_withdrawn_at", {
      withTimezone: true,
      mode: "date",
    }),
    campus: text("campus"),
    yearOfStudy: smallint("year_of_study"),
    status: participantStatus("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "participants_id_matches_role",
      sql`(${table.role} = 'learner' AND ${table.participantId} ~ '^L-[0-9a-f]{10}$') OR (${table.role} = 'mentor' AND ${table.participantId} ~ '^M-[0-9a-f]{10}$') OR (${table.role} = 'operator' AND ${table.participantId} ~ '^O-[0-9a-f]{10}$')`,
    ),
    check(
      "participants_consent_order",
      sql`${table.consentWithdrawnAt} IS NULL OR (${table.consentGivenAt} IS NOT NULL AND ${table.consentWithdrawnAt} >= ${table.consentGivenAt})`,
    ),
    check(
      "participants_year_valid",
      sql`${table.yearOfStudy} IS NULL OR (${table.yearOfStudy} BETWEEN 1 AND 8)`,
    ),
  ],
);

/** Maps an authenticated account to its anonymised participant identity by role. */
export const accountParticipants = pgTable(
  "account_participants",
  {
    authUserId: text("auth_user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    role: accountActiveRole("role").notNull(),
    participantId: text("participant_id")
      .notNull()
      .references(() => participants.participantId, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("account_participants_user_role_unique").on(
      table.authUserId,
      table.role,
    ),
    uniqueIndex("account_participants_participant_unique").on(
      table.participantId,
    ),
    index("account_participants_user_idx").on(table.authUserId),
    check(
      "account_participants_role_matches_id",
      sql`(${table.role} = 'learner' AND ${table.participantId} ~ '^L-[0-9a-f]{10}$') OR (${table.role} = 'mentor' AND ${table.participantId} ~ '^M-[0-9a-f]{10}$')`,
    ),
  ],
);

// Contact values live in this table only; event rows deliberately have no contact columns.
export const participantContacts = pgTable(
  "participant_contacts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    participantId: text("participant_id")
      .notNull()
      .references(() => participants.participantId, { onDelete: "cascade" }),
    contactType: contactType("contact_type").notNull(),
    value: text("value").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("participant_contacts_participant_idx").on(table.participantId),
  ],
);

export const learnerRequests = pgTable(
  "learner_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    participantId: text("participant_id")
      .notNull()
      .references(() => participants.participantId),
    taskCategory: taskCategory("task_category").notNull(),
    taskDescription: text("task_description").notNull(),
    triedAlready: text("tried_already").notNull(),
    deadlineAt: timestamp("deadline_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    preferredWindows: jsonb("preferred_windows")
      .$type<TimeWindow[]>()
      .notNull(),
    giveBack: text("give_back"),
    status: learnerRequestStatus("status").notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("learner_requests_participant_idx").on(table.participantId),
    index("learner_requests_status_idx").on(table.status),
  ],
);

export const mentorProfiles = pgTable("mentor_profiles", {
  participantId: text("participant_id")
    .primaryKey()
    .references(() => participants.participantId),
  displayName: text("display_name"),
  experienceStatement: text("experience_statement"),
  availabilityWindows: jsonb("availability_windows")
    .$type<TimeWindow[]>()
    .notNull()
    .default([]),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export const skillEvidence = pgTable(
  "skill_evidence",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    mentorParticipantId: text("mentor_participant_id")
      .notNull()
      .references(() => mentorProfiles.participantId),
    category: skillCategory("category").notNull(),
    topic: text("topic").notNull(),
    proofType: text("proof_type").notNull(),
    proofReference: text("proof_reference").notNull(),
    verificationState: skillVerificationState("verification_state")
      .notNull()
      .default("pending"),
    verifiedAt: timestamp("verified_at", { withTimezone: true, mode: "date" }),
    verifiedBy: text("verified_by").references(
      () => participants.participantId,
    ),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("skill_evidence_mentor_idx").on(table.mentorParticipantId),
    check(
      "skill_evidence_verification_actor",
      sql`(${table.verificationState} = 'pending' AND ${table.verifiedAt} IS NULL AND ${table.verifiedBy} IS NULL) OR (${table.verificationState} <> 'pending' AND ${table.verifiedAt} IS NOT NULL AND ${table.verifiedBy} IS NOT NULL)`,
    ),
  ],
);

export const mentorBriefs = pgTable(
  "mentor_briefs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => learnerRequests.id),
    mentorParticipantId: text("mentor_participant_id")
      .notNull()
      .references(() => mentorProfiles.participantId),
    templateVersion: text("template_version").notNull(),
    sentAt: timestamp("sent_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    answerBy: timestamp("answer_by", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    status: mentorBriefStatus("status").notNull().default("invited"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("mentor_briefs_request_idx").on(table.requestId),
    index("mentor_briefs_mentor_idx").on(table.mentorParticipantId),
    check(
      "mentor_briefs_answer_after_sent",
      sql`${table.answerBy} > ${table.sentAt}`,
    ),
  ],
);

export const matches = pgTable(
  "matches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => learnerRequests.id),
    recommendedMentorId: text("recommended_mentor_id").references(
      () => mentorProfiles.participantId,
    ),
    recommendationReason: text("recommendation_reason"),
    mentorParticipantId: text("mentor_participant_id").references(
      () => mentorProfiles.participantId,
    ),
    humanDecision: matchHumanDecision("human_decision")
      .notNull()
      .default("pending"),
    humanDecisionReason: text("human_decision_reason"),
    proposedSlotAt: timestamp("proposed_slot_at", {
      withTimezone: true,
      mode: "date",
    }),
    mentorAcceptedAt: timestamp("mentor_accepted_at", {
      withTimezone: true,
      mode: "date",
    }),
    learnerAcceptedAt: timestamp("learner_accepted_at", {
      withTimezone: true,
      mode: "date",
    }),
    status: matchStatus("status").notNull().default("proposed"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("matches_request_idx").on(table.requestId),
    index("matches_mentor_idx").on(table.mentorParticipantId),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id),
    startsAt: timestamp("starts_at", { withTimezone: true, mode: "date" }),
    endsAt: timestamp("ends_at", { withTimezone: true, mode: "date" }),
    templateVersion: text("template_version").notNull(),
    completionState: sessionCompletionState("completion_state")
      .notNull()
      .default("scheduled"),
    meetUrl: text("meet_url"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("sessions_match_unique").on(table.matchId),
    check(
      "sessions_time_order",
      sql`${table.startsAt} IS NULL OR ${table.endsAt} IS NULL OR ${table.endsAt} > ${table.startsAt}`,
    ),
  ],
);

export const feedback = pgTable(
  "feedback",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id),
    participantId: text("participant_id")
      .notNull()
      .references(() => participants.participantId),
    unblocked: smallint("unblocked"),
    unblockedMissingReason: missingReason("unblocked_missing_reason"),
    oneLineOutcome: text("one_line_outcome"),
    outcomeMissingReason: missingReason("outcome_missing_reason"),
    trust: smallint("trust"),
    trustMissingReason: missingReason("trust_missing_reason"),
    safetyFlag: boolean("safety_flag"),
    safetyMissingReason: missingReason("safety_missing_reason"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("feedback_session_participant_unique").on(
      table.sessionId,
      table.participantId,
    ),
    check(
      "feedback_unblocked_value",
      sql`${table.unblocked} IS NULL OR ${table.unblocked} BETWEEN 1 AND 5`,
    ),
    check(
      "feedback_trust_value",
      sql`${table.trust} IS NULL OR ${table.trust} BETWEEN 1 AND 5`,
    ),
    check(
      "feedback_unblocked_missing_pair",
      sql`(${table.unblocked} IS NULL) = (${table.unblockedMissingReason} IS NOT NULL)`,
    ),
    check(
      "feedback_outcome_missing_pair",
      sql`(${table.oneLineOutcome} IS NULL) = (${table.outcomeMissingReason} IS NOT NULL)`,
    ),
    check(
      "feedback_trust_missing_pair",
      sql`(${table.trust} IS NULL) = (${table.trustMissingReason} IS NOT NULL)`,
    ),
    check(
      "feedback_safety_missing_pair",
      sql`(${table.safetyFlag} IS NULL) = (${table.safetyMissingReason} IS NOT NULL)`,
    ),
  ],
);

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    participantId: text("participant_id")
      .notNull()
      .references(() => participants.participantId),
    category: reportCategory("category").notNull(),
    details: text("details"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("reports_participant_created_idx").on(
      table.participantId,
      table.createdAt,
    ),
  ],
);

export const events = pgTable(
  "events",
  {
    eventId: uuid("event_id").defaultRandom().primaryKey(),
    participantId: text("participant_id")
      .notNull()
      .references(() => participants.participantId),
    role: participantRole("role").notNull(),
    eventName: eventName("event_name").notNull(),
    timestampUtc: timestamp("timestamp_utc", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .defaultNow(),
    // Nullable for platform activity outside E1/E2/E3; see README open questions.
    experiment: experimentId("experiment"),
    dataOrigin: dataOrigin("data_origin").notNull(),
    uiLocale: text("ui_locale").notNull().default("en"),
    templateVersion: text("template_version"),
    briefType: briefType("brief_type"),
    taskCategory: taskCategory("task_category"),
    sourceChannel: text("source_channel"),
    reasonCode: text("reason_code"),
    value: integer("value"),
    missingReason: missingReason("missing_reason"),
    actor: text("actor"),
    correctsEventId: uuid("corrects_event_id").references(
      (): AnyPgColumn => events.eventId,
    ),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("events_participant_timestamp_idx").on(
      table.participantId,
      table.timestampUtc,
    ),
    index("events_name_timestamp_idx").on(table.eventName, table.timestampUtc),
    check(
      "events_participant_role_prefix",
      sql`(${table.role} = 'learner' AND ${table.participantId} LIKE 'L-%') OR (${table.role} = 'mentor' AND ${table.participantId} LIKE 'M-%') OR (${table.role} = 'operator' AND ${table.participantId} LIKE 'O-%')`,
    ),
    check("events_ui_locale_en", sql`${table.uiLocale} = 'en'`),
    check(
      "events_reason_code_required",
      sql`${table.eventName} NOT IN ('decline_reason', 'no_show', 'safety_flag') OR ${table.reasonCode} IS NOT NULL`,
    ),
    check(
      "events_brief_type_required",
      sql`${table.eventName} <> 'brief_sent' OR ${table.briefType} IS NOT NULL`,
    ),
  ],
);

export const stateTransitions = pgTable(
  "state_transitions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    subjectType: transitionSubject("subject_type").notNull(),
    subjectId: uuid("subject_id").notNull(),
    fromState: text("from_state").notNull(),
    toState: text("to_state").notNull(),
    actorType: transitionActorType("actor_type").notNull(),
    actorParticipantId: text("actor_participant_id").references(
      () => participants.participantId,
    ),
    transitionedAt: timestamp("transitioned_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .defaultNow(),
    source: text("source").notNull(),
    reasonCode: text("reason_code").notNull(),
  },
  (table) => [
    index("state_transitions_subject_idx").on(
      table.subjectType,
      table.subjectId,
      table.transitionedAt,
    ),
    check(
      "state_transition_actor_consistency",
      sql`(${table.actorType} = 'system' AND ${table.actorParticipantId} IS NULL) OR (${table.actorType} <> 'system' AND ${table.actorParticipantId} IS NOT NULL)`,
    ),
  ],
);

export const linkTokens = pgTable(
  "link_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tokenHash: bytea("token_hash").notNull(),
    purpose: tokenPurpose("purpose").notNull(),
    subjectType: tokenSubjectType("subject_type").notNull(),
    subjectId: text("subject_id").notNull(),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("link_tokens_hash_unique").on(table.tokenHash),
    index("link_tokens_subject_idx").on(table.subjectType, table.subjectId),
  ],
);

export const rateLimitCounters = pgTable(
  "rate_limit_counters",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    keyHash: text("key_hash").notNull(),
    windowStartedAt: timestamp("window_started_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    count: integer("count").notNull().default(0),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
  },
  (table) => [
    uniqueIndex("rate_limit_counters_key_window_unique").on(
      table.keyHash,
      table.windowStartedAt,
    ),
    index("rate_limit_counters_expiry_idx").on(table.expiresAt),
    check("rate_limit_counters_nonnegative", sql`${table.count} >= 0`),
  ],
);
