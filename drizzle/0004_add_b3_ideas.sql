CREATE TABLE IF NOT EXISTS "b3_ideas" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"kind" text NOT NULL,
	"signal" text NOT NULL,
	"conviction" text NOT NULL,
	"score" double precision NOT NULL,
	"title" text NOT NULL,
	"detail" text NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "b3_ideas_kind_idx" ON "b3_ideas" ("kind");
