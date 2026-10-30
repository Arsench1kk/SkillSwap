CREATE TYPE "public"."report_category" AS ENUM('safety_concern', 'mentor_conduct', 'scheduling', 'privacy_contact', 'other');--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"participant_id" text NOT NULL,
	"category" "report_category" NOT NULL,
	"details" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_participant_id_participants_participant_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("participant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reports_participant_created_idx" ON "reports" USING btree ("participant_id", "created_at");
