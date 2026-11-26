ALTER TABLE "participant_contacts" ADD COLUMN "learner_request_id" uuid;--> statement-breakpoint
ALTER TABLE "learner_requests" ADD CONSTRAINT "learner_requests_id_participant_unique" UNIQUE("id","participant_id");--> statement-breakpoint
ALTER TABLE "participant_contacts" ADD CONSTRAINT "participant_contacts_learner_request_owner_fk" FOREIGN KEY ("learner_request_id","participant_id") REFERENCES "public"."learner_requests"("id","participant_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_contacts" ADD CONSTRAINT "participant_contacts_learner_request_unique" UNIQUE("learner_request_id");
