DROP TABLE IF EXISTS "topic_requests";

CREATE TABLE IF NOT EXISTS "idea_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"pair" text NOT NULL,
	"signal" text NOT NULL,
	"conviction" text NOT NULL,
	"score" double precision NOT NULL,
	"close_at_snapshot" double precision NOT NULL,
	"outcome" text,
	"actual_change_pct" double precision,
	"evaluated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idea_snapshots_created_at_idx" ON "idea_snapshots" ("created_at");
