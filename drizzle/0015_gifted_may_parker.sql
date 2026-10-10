CREATE TYPE "public"."journey_kind" AS ENUM('flight', 'train');--> statement-breakpoint
CREATE TABLE "journeys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"kind" "journey_kind" NOT NULL,
	"carrier" text NOT NULL,
	"number" text NOT NULL,
	"origin" text NOT NULL,
	"destination" text NOT NULL,
	"stopover" text,
	"origin_city" text,
	"destination_city" text,
	"departure_date" date NOT NULL,
	"departure_time" text,
	"arrival_date" date,
	"arrival_time" text,
	"departure_tz" text,
	"arrival_tz" text,
	"seat" text,
	"gate" text,
	"coach" text,
	"vehicle" text,
	"aircraft_reg" text,
	"price" numeric(12, 2),
	"currency" text,
	"booking_ref" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "journeys" ADD CONSTRAINT "journeys_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "journeys_user_departure_idx" ON "journeys" USING btree ("user_id","departure_date");--> statement-breakpoint
CREATE UNIQUE INDEX "journeys_unique_idx" ON "journeys" USING btree ("user_id","kind","carrier","number","departure_date");