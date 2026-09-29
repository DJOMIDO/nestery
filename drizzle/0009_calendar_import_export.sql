ALTER TABLE "events" ADD COLUMN "ics_uid" text;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "time_zone" text;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "feed_token" text;--> statement-breakpoint
CREATE UNIQUE INDEX "events_user_ics_uid_idx" ON "events" USING btree ("user_id","ics_uid");--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_feedToken_unique" UNIQUE("feed_token");