ALTER TABLE "user_settings" ADD COLUMN "date_locale" text DEFAULT 'en-US' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "hour_cycle" text;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "week_start" smallint DEFAULT 1 NOT NULL;