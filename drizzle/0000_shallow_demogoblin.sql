CREATE TABLE "flow_series" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"close" double precision NOT NULL,
	"change_pct" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "macro_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"country" text NOT NULL,
	"title" text NOT NULL,
	"source_url" text,
	"source_name" text NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_summaries" (
	"id" serial PRIMARY KEY NOT NULL,
	"week_start" timestamp with time zone NOT NULL,
	"summary" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "youtube_videos" (
	"id" serial PRIMARY KEY NOT NULL,
	"video_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"channel_title" text NOT NULL,
	"title" text NOT NULL,
	"matched_tags" text[] DEFAULT '{}' NOT NULL,
	"subscribed" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "flow_series_symbol_date_idx" ON "flow_series" USING btree ("symbol","date");--> statement-breakpoint
CREATE UNIQUE INDEX "flow_series_symbol_date_unique" ON "flow_series" USING btree ("symbol","date");--> statement-breakpoint
CREATE INDEX "macro_events_published_at_idx" ON "macro_events" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "macro_events_category_idx" ON "macro_events" USING btree ("category");--> statement-breakpoint
CREATE UNIQUE INDEX "macro_events_source_url_idx" ON "macro_events" USING btree ("source_url");--> statement-breakpoint
CREATE UNIQUE INDEX "weekly_summaries_week_start_idx" ON "weekly_summaries" USING btree ("week_start");--> statement-breakpoint
CREATE INDEX "youtube_videos_published_at_idx" ON "youtube_videos" USING btree ("published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "youtube_videos_video_id_idx" ON "youtube_videos" USING btree ("video_id");