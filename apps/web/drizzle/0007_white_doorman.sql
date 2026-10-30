CREATE TABLE "account_participants" (
	"auth_user_id" text NOT NULL,
	"role" "account_active_role" NOT NULL,
	"participant_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_participants_role_matches_id" CHECK (("account_participants"."role" = 'learner' AND "account_participants"."participant_id" ~ '^L-[0-9a-f]{10}$') OR ("account_participants"."role" = 'mentor' AND "account_participants"."participant_id" ~ '^M-[0-9a-f]{10}$'))
);
--> statement-breakpoint
ALTER TABLE "account_participants" ADD CONSTRAINT "account_participants_auth_user_id_user_id_fk" FOREIGN KEY ("auth_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_participants" ADD CONSTRAINT "account_participants_participant_id_participants_participant_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("participant_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_participants_user_role_unique" ON "account_participants" USING btree ("auth_user_id","role");--> statement-breakpoint
CREATE UNIQUE INDEX "account_participants_participant_unique" ON "account_participants" USING btree ("participant_id");--> statement-breakpoint
CREATE INDEX "account_participants_user_idx" ON "account_participants" USING btree ("auth_user_id");