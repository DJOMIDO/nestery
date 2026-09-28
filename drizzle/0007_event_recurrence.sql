ALTER TABLE "events" ADD COLUMN "rrule" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "exdates" date[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "series_id" uuid;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_series_id_events_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;