CREATE TYPE "public"."actor_type" AS ENUM('pass', 'crew', 'system');--> statement-breakpoint
CREATE TYPE "public"."pass_origin" AS ENUM('self', 'crew');--> statement-breakpoint
CREATE TYPE "public"."realm" AS ENUM('live', 'rehearsal');--> statement-breakpoint
CREATE TYPE "public"."stage" AS ENUM('setup', 'voting_open', 'voting_closed', 'results_revealed');--> statement-breakpoint
CREATE TYPE "public"."vote_status" AS ENUM('counted', 'voided', 'released');--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"realm" realm NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_type" "actor_type" NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contest" (
	"realm" realm PRIMARY KEY NOT NULL,
	"stage" "stage" DEFAULT 'setup' NOT NULL,
	"reveal_step" smallint DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"entries_version" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contest_reveal_step" CHECK ("contest"."reveal_step" between 0 and 3)
);
--> statement-breakpoint
CREATE TABLE "crew_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"realm" realm NOT NULL,
	"photo_id" uuid NOT NULL,
	"consent_confirmed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "entry_passes" (
	"entry_id" uuid NOT NULL,
	"pass_id" uuid NOT NULL,
	CONSTRAINT "entry_passes_entry_id_pass_id_pk" PRIMARY KEY("entry_id","pass_id")
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"key" uuid NOT NULL,
	"scope" text NOT NULL,
	"response_status" integer,
	"response_body" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "idempotency_keys_key_scope_pk" PRIMARY KEY("key","scope")
);
--> statement-breakpoint
CREATE TABLE "passes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"realm" realm NOT NULL,
	"token_hash" "bytea",
	"nickname" text NOT NULL,
	"number" integer NOT NULL,
	"origin" "pass_origin" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_crew_session_id" uuid
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" smallint PRIMARY KEY NOT NULL,
	"rehearsal_mode" boolean DEFAULT false NOT NULL,
	"event_start" timestamp with time zone NOT NULL,
	"event_end" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settings_singleton" CHECK ("settings"."id" = 1),
	CONSTRAINT "settings_window_order" CHECK ("settings"."event_end" > "settings"."event_start")
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"realm" realm NOT NULL,
	"pass_id" uuid NOT NULL,
	"entry_id" uuid NOT NULL,
	"status" "vote_status" DEFAULT 'counted' NOT NULL,
	"assisted_by_crew_session_id" uuid,
	"cast_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status_changed_by_crew_session_id" uuid
);
--> statement-breakpoint
ALTER TABLE "entry_passes" ADD CONSTRAINT "entry_passes_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_passes" ADD CONSTRAINT "entry_passes_pass_id_passes_id_fk" FOREIGN KEY ("pass_id") REFERENCES "public"."passes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passes" ADD CONSTRAINT "passes_created_by_crew_session_id_crew_sessions_id_fk" FOREIGN KEY ("created_by_crew_session_id") REFERENCES "public"."crew_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_pass_id_passes_id_fk" FOREIGN KEY ("pass_id") REFERENCES "public"."passes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_assisted_by_crew_session_id_crew_sessions_id_fk" FOREIGN KEY ("assisted_by_crew_session_id") REFERENCES "public"."crew_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_status_changed_by_crew_session_id_crew_sessions_id_fk" FOREIGN KEY ("status_changed_by_crew_session_id") REFERENCES "public"."crew_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_realm_at" ON "audit_events" USING btree ("realm","at");--> statement-breakpoint
CREATE INDEX "entries_realm" ON "entries" USING btree ("realm");--> statement-breakpoint
CREATE UNIQUE INDEX "entry_passes_pass" ON "entry_passes" USING btree ("pass_id");--> statement-breakpoint
CREATE UNIQUE INDEX "passes_realm_nickname" ON "passes" USING btree ("realm","nickname");--> statement-breakpoint
CREATE UNIQUE INDEX "passes_realm_number" ON "passes" USING btree ("realm","number");--> statement-breakpoint
CREATE UNIQUE INDEX "passes_token_hash" ON "passes" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "votes_one_per_pass" ON "votes" USING btree ("pass_id") WHERE "votes"."status" in ('counted', 'voided');--> statement-breakpoint
CREATE INDEX "votes_realm_entry" ON "votes" USING btree ("realm","entry_id");