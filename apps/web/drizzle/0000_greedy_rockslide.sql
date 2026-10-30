CREATE TYPE "public"."brief_type" AS ENUM('P', 'S');--> statement-breakpoint
CREATE TYPE "public"."contact_type" AS ENUM('telegram', 'phone');--> statement-breakpoint
CREATE TYPE "public"."data_origin" AS ENUM('real_pilot', 'constructed', 'rehearsal');--> statement-breakpoint
CREATE TYPE "public"."event_name" AS ENUM('request_submitted', 'brief_sent', 'mentor_viewed', 'mentor_accepted', 'slot_proposed', 'match_accepted', 'session_started', 'session_completed', 'usefulness_submitted', 'trust_submitted', 'no_show', 'decline_reason', 'mentor_no_reply', 'eligibility_checked', 'match_proposed', 'safety_flag', 'followup_48h');--> statement-breakpoint
CREATE TYPE "public"."experiment_id" AS ENUM('E1', 'E2', 'E3');--> statement-breakpoint
CREATE TYPE "public"."learner_request_status" AS ENUM('draft', 'submitted', 'eligible', 'matching', 'matched', 'session_scheduled', 'completed', 'ineligible', 'expired', 'cancelled', 'no_match', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."match_human_decision" AS ENUM('pending', 'accepted', 'rejected', 'modified');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('proposed', 'accepted', 'declined', 'withdrawn', 'expired');--> statement-breakpoint
CREATE TYPE "public"."mentor_brief_status" AS ENUM('invited', 'viewed', 'accepted', 'slot_proposed', 'confirmed', 'completed', 'declined', 'no_reply', 'expired', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."missing_reason" AS ENUM('no_reply', 'declined', 'no_skill_match', 'incomplete', 'excluded');--> statement-breakpoint
CREATE TYPE "public"."participant_role" AS ENUM('learner', 'mentor', 'operator');--> statement-breakpoint
CREATE TYPE "public"."participant_status" AS ENUM('active', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."session_completion_state" AS ENUM('scheduled', 'started', 'completed', 'cancelled', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."skill_category" AS ENUM('STEM', 'creative');--> statement-breakpoint
CREATE TYPE "public"."skill_verification_state" AS ENUM('pending', 'verified', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."task_category" AS ENUM('STEM', 'creative');--> statement-breakpoint
CREATE TYPE "public"."token_purpose" AS ENUM('learner_status', 'mentor_brief', 'session', 'rating', 'report');--> statement-breakpoint
CREATE TYPE "public"."token_subject_type" AS ENUM('participant', 'learner_request', 'mentor_brief', 'match', 'session', 'feedback');--> statement-breakpoint
CREATE TYPE "public"."transition_actor_type" AS ENUM('participant', 'operator', 'system');--> statement-breakpoint
CREATE TYPE "public"."transition_subject" AS ENUM('learner_request', 'mentor_brief');--> statement-breakpoint
CREATE TABLE "events" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"participant_id" text NOT NULL,
	"role" "participant_role" NOT NULL,
	"event_name" "event_name" NOT NULL,
	"timestamp_utc" timestamp with time zone DEFAULT now() NOT NULL,
	"experiment" "experiment_id",
	"data_origin" "data_origin" NOT NULL,
	"ui_locale" text DEFAULT 'en' NOT NULL,
	"template_version" text,
	"brief_type" "brief_type",
	"task_category" "task_category",
	"source_channel" text,
	"reason_code" text,
	"value" integer,
	"missing_reason" "missing_reason",
	"actor" text,
	"corrects_event_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_participant_role_prefix" CHECK (("events"."role" = 'learner' AND "events"."participant_id" LIKE 'L-%') OR ("events"."role" = 'mentor' AND "events"."participant_id" LIKE 'M-%') OR ("events"."role" = 'operator' AND "events"."participant_id" LIKE 'O-%')),
	CONSTRAINT "events_ui_locale_en" CHECK ("events"."ui_locale" = 'en'),
	CONSTRAINT "events_reason_code_required" CHECK ("events"."event_name" NOT IN ('decline_reason', 'no_show', 'safety_flag') OR "events"."reason_code" IS NOT NULL),
	CONSTRAINT "events_brief_type_required" CHECK ("events"."event_name" <> 'brief_sent' OR "events"."brief_type" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"participant_id" text NOT NULL,
	"unblocked" smallint,
	"unblocked_missing_reason" "missing_reason",
	"one_line_outcome" text,
	"outcome_missing_reason" "missing_reason",
	"trust" smallint,
	"trust_missing_reason" "missing_reason",
	"safety_flag" boolean,
	"safety_missing_reason" "missing_reason",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_unblocked_value" CHECK ("feedback"."unblocked" IS NULL OR "feedback"."unblocked" BETWEEN 1 AND 5),
	CONSTRAINT "feedback_trust_value" CHECK ("feedback"."trust" IS NULL OR "feedback"."trust" BETWEEN 1 AND 5),
	CONSTRAINT "feedback_unblocked_missing_pair" CHECK (("feedback"."unblocked" IS NULL) = ("feedback"."unblocked_missing_reason" IS NOT NULL)),
	CONSTRAINT "feedback_outcome_missing_pair" CHECK (("feedback"."one_line_outcome" IS NULL) = ("feedback"."outcome_missing_reason" IS NOT NULL)),
	CONSTRAINT "feedback_trust_missing_pair" CHECK (("feedback"."trust" IS NULL) = ("feedback"."trust_missing_reason" IS NOT NULL)),
	CONSTRAINT "feedback_safety_missing_pair" CHECK (("feedback"."safety_flag" IS NULL) = ("feedback"."safety_missing_reason" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "learner_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"participant_id" text NOT NULL,
	"task_category" "task_category" NOT NULL,
	"task_description" text NOT NULL,
	"tried_already" text NOT NULL,
	"deadline_at" timestamp with time zone NOT NULL,
	"preferred_windows" jsonb NOT NULL,
	"give_back" text,
	"status" "learner_request_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "link_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" "bytea" NOT NULL,
	"purpose" "token_purpose" NOT NULL,
	"subject_type" "token_subject_type" NOT NULL,
	"subject_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"recommended_mentor_id" text,
	"recommendation_reason" text,
	"mentor_participant_id" text,
	"human_decision" "match_human_decision" DEFAULT 'pending' NOT NULL,
	"human_decision_reason" text,
	"proposed_slot_at" timestamp with time zone,
	"mentor_accepted_at" timestamp with time zone,
	"learner_accepted_at" timestamp with time zone,
	"status" "match_status" DEFAULT 'proposed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mentor_briefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"mentor_participant_id" text NOT NULL,
	"template_version" text NOT NULL,
	"sent_at" timestamp with time zone NOT NULL,
	"answer_by" timestamp with time zone NOT NULL,
	"status" "mentor_brief_status" DEFAULT 'invited' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mentor_briefs_answer_after_sent" CHECK ("mentor_briefs"."answer_by" > "mentor_briefs"."sent_at")
);
--> statement-breakpoint
CREATE TABLE "mentor_profiles" (
	"participant_id" text PRIMARY KEY NOT NULL,
	"experience_statement" text,
	"availability_windows" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "participant_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"participant_id" text NOT NULL,
	"contact_type" "contact_type" NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "participants" (
	"participant_id" text PRIMARY KEY NOT NULL,
	"role" "participant_role" NOT NULL,
	"consent_given_at" timestamp with time zone,
	"consent_withdrawn_at" timestamp with time zone,
	"campus" text,
	"year_of_study" smallint,
	"status" "participant_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "participants_id_matches_role" CHECK (("participants"."role" = 'learner' AND "participants"."participant_id" ~ '^L-[0-9a-f]{10}$') OR ("participants"."role" = 'mentor' AND "participants"."participant_id" ~ '^M-[0-9a-f]{10}$') OR ("participants"."role" = 'operator' AND "participants"."participant_id" ~ '^O-[0-9a-f]{10}$')),
	CONSTRAINT "participants_consent_order" CHECK ("participants"."consent_withdrawn_at" IS NULL OR ("participants"."consent_given_at" IS NOT NULL AND "participants"."consent_withdrawn_at" >= "participants"."consent_given_at")),
	CONSTRAINT "participants_year_valid" CHECK ("participants"."year_of_study" IS NULL OR ("participants"."year_of_study" BETWEEN 1 AND 8))
);
--> statement-breakpoint
CREATE TABLE "rate_limit_counters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key_hash" text NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "rate_limit_counters_nonnegative" CHECK ("rate_limit_counters"."count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"template_version" text NOT NULL,
	"completion_state" "session_completion_state" DEFAULT 'scheduled' NOT NULL,
	"meet_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_time_order" CHECK ("sessions"."starts_at" IS NULL OR "sessions"."ends_at" IS NULL OR "sessions"."ends_at" > "sessions"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "skill_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mentor_participant_id" text NOT NULL,
	"category" "skill_category" NOT NULL,
	"topic" text NOT NULL,
	"proof_type" text NOT NULL,
	"proof_reference" text NOT NULL,
	"verification_state" "skill_verification_state" DEFAULT 'pending' NOT NULL,
	"verified_at" timestamp with time zone,
	"verified_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "skill_evidence_verification_actor" CHECK (("skill_evidence"."verification_state" = 'pending' AND "skill_evidence"."verified_at" IS NULL AND "skill_evidence"."verified_by" IS NULL) OR ("skill_evidence"."verification_state" <> 'pending' AND "skill_evidence"."verified_at" IS NOT NULL AND "skill_evidence"."verified_by" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "state_transitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_type" "transition_subject" NOT NULL,
	"subject_id" uuid NOT NULL,
	"from_state" text NOT NULL,
	"to_state" text NOT NULL,
	"actor_type" "transition_actor_type" NOT NULL,
	"actor_participant_id" text,
	"transitioned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" text NOT NULL,
	"reason_code" text NOT NULL,
	CONSTRAINT "state_transition_actor_consistency" CHECK (("state_transitions"."actor_type" = 'system' AND "state_transitions"."actor_participant_id" IS NULL) OR ("state_transitions"."actor_type" <> 'system' AND "state_transitions"."actor_participant_id" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_participant_id_participants_participant_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("participant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_corrects_event_id_events_event_id_fk" FOREIGN KEY ("corrects_event_id") REFERENCES "public"."events"("event_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_participant_id_participants_participant_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("participant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_requests" ADD CONSTRAINT "learner_requests_participant_id_participants_participant_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("participant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_request_id_learner_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."learner_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_recommended_mentor_id_mentor_profiles_participant_id_fk" FOREIGN KEY ("recommended_mentor_id") REFERENCES "public"."mentor_profiles"("participant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_mentor_participant_id_mentor_profiles_participant_id_fk" FOREIGN KEY ("mentor_participant_id") REFERENCES "public"."mentor_profiles"("participant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentor_briefs" ADD CONSTRAINT "mentor_briefs_request_id_learner_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."learner_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentor_briefs" ADD CONSTRAINT "mentor_briefs_mentor_participant_id_mentor_profiles_participant_id_fk" FOREIGN KEY ("mentor_participant_id") REFERENCES "public"."mentor_profiles"("participant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentor_profiles" ADD CONSTRAINT "mentor_profiles_participant_id_participants_participant_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("participant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_contacts" ADD CONSTRAINT "participant_contacts_participant_id_participants_participant_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("participant_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_evidence" ADD CONSTRAINT "skill_evidence_mentor_participant_id_mentor_profiles_participant_id_fk" FOREIGN KEY ("mentor_participant_id") REFERENCES "public"."mentor_profiles"("participant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_evidence" ADD CONSTRAINT "skill_evidence_verified_by_participants_participant_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."participants"("participant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "state_transitions" ADD CONSTRAINT "state_transitions_actor_participant_id_participants_participant_id_fk" FOREIGN KEY ("actor_participant_id") REFERENCES "public"."participants"("participant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_participant_timestamp_idx" ON "events" USING btree ("participant_id","timestamp_utc");--> statement-breakpoint
CREATE INDEX "events_name_timestamp_idx" ON "events" USING btree ("event_name","timestamp_utc");--> statement-breakpoint
CREATE UNIQUE INDEX "feedback_session_participant_unique" ON "feedback" USING btree ("session_id","participant_id");--> statement-breakpoint
CREATE INDEX "learner_requests_participant_idx" ON "learner_requests" USING btree ("participant_id");--> statement-breakpoint
CREATE INDEX "learner_requests_status_idx" ON "learner_requests" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "link_tokens_hash_unique" ON "link_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "link_tokens_subject_idx" ON "link_tokens" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "matches_request_idx" ON "matches" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "matches_mentor_idx" ON "matches" USING btree ("mentor_participant_id");--> statement-breakpoint
CREATE INDEX "mentor_briefs_request_idx" ON "mentor_briefs" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "mentor_briefs_mentor_idx" ON "mentor_briefs" USING btree ("mentor_participant_id");--> statement-breakpoint
CREATE INDEX "participant_contacts_participant_idx" ON "participant_contacts" USING btree ("participant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rate_limit_counters_key_window_unique" ON "rate_limit_counters" USING btree ("key_hash","window_started_at");--> statement-breakpoint
CREATE INDEX "rate_limit_counters_expiry_idx" ON "rate_limit_counters" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_match_unique" ON "sessions" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "skill_evidence_mentor_idx" ON "skill_evidence" USING btree ("mentor_participant_id");--> statement-breakpoint
CREATE INDEX "state_transitions_subject_idx" ON "state_transitions" USING btree ("subject_type","subject_id","transitioned_at");--> statement-breakpoint
CREATE FUNCTION reject_immutable_record_mutation() RETURNS trigger AS $$
BEGIN
	RAISE EXCEPTION '% is append-only; corrections must be inserted as new rows', TG_TABLE_NAME
		USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER events_append_only
	BEFORE UPDATE OR DELETE ON events
	FOR EACH ROW EXECUTE FUNCTION reject_immutable_record_mutation();--> statement-breakpoint
CREATE TRIGGER state_transitions_append_only
	BEFORE UPDATE OR DELETE ON state_transitions
	FOR EACH ROW EXECUTE FUNCTION reject_immutable_record_mutation();--> statement-breakpoint
CREATE FUNCTION enforce_operator_skill_verification() RETURNS trigger AS $$
DECLARE
	operator_role participant_role;
BEGIN
	IF TG_OP = 'UPDATE' AND NEW.verification_state IS NOT DISTINCT FROM OLD.verification_state THEN
		RETURN NEW;
	END IF;
	IF NEW.verification_state = 'pending' THEN
		IF TG_OP = 'UPDATE' AND OLD.verification_state <> 'pending' THEN
			RAISE EXCEPTION 'A completed skill verification cannot be reset to pending';
		END IF;
		RETURN NEW;
	END IF;
	SELECT role INTO operator_role
	FROM participants
	WHERE participant_id = NEW.verified_by;
	IF operator_role IS DISTINCT FROM 'operator'::participant_role THEN
		RAISE EXCEPTION 'Only an operator participant may verify skill evidence';
	END IF;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER skill_verification_operator_only
	BEFORE INSERT OR UPDATE OF verification_state, verified_by ON skill_evidence
	FOR EACH ROW EXECUTE FUNCTION enforce_operator_skill_verification();
