CREATE TABLE IF NOT EXISTS "carteira_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"monthly_goal_pct" double precision DEFAULT 2 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
