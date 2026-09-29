CREATE TABLE "calendar_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"color" text DEFAULT 'sky' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"ics" text,
	"last_fetched_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "calendar_subscriptions" ADD CONSTRAINT "calendar_subscriptions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "calendar_subscriptions_user_id_idx" ON "calendar_subscriptions" USING btree ("user_id");