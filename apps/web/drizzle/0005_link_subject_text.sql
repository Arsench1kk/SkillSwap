ALTER TABLE "link_tokens"
  ALTER COLUMN "subject_id" TYPE text
  USING "subject_id"::text;
