CREATE TABLE "note_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"note_id" uuid,
	"storage_key" text NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"uploaded" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"orphaned_at" timestamp with time zone,
	CONSTRAINT "note_attachments_storageKey_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
ALTER TABLE "note_attachments" ADD CONSTRAINT "note_attachments_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_attachments" ADD CONSTRAINT "note_attachments_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "note_attachments_user_idx" ON "note_attachments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "note_attachments_note_idx" ON "note_attachments" USING btree ("note_id");