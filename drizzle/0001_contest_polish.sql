ALTER TYPE "public"."vote_status" ADD VALUE 'replaced';--> statement-breakpoint
ALTER TABLE "contest" ADD COLUMN "voting_closes_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "entries" ADD COLUMN "costume_title" text;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_costume_title_len" CHECK ("entries"."costume_title" is null or char_length("entries"."costume_title") between 1 and 40);