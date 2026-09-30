CREATE TABLE IF NOT EXISTS "broker_balances" (
	"id" serial PRIMARY KEY NOT NULL,
	"broker" text NOT NULL,
	"entry_date" timestamp with time zone NOT NULL,
	"balance" double precision NOT NULL,
	"deposit" double precision DEFAULT 0 NOT NULL,
	"withdrawal" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "broker_balances_broker_date_idx" ON "broker_balances" ("broker","entry_date");
CREATE UNIQUE INDEX IF NOT EXISTS "broker_balances_broker_date_unique" ON "broker_balances" ("broker","entry_date");
