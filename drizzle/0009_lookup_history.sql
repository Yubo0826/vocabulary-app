CREATE TABLE "lookup_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"headword" text NOT NULL,
	"viewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "lookup_history" ADD CONSTRAINT "lookup_history_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lookup_history_user_headword_idx" ON "lookup_history" USING btree ("user_id","headword");--> statement-breakpoint
CREATE INDEX "lookup_history_user_viewed_idx" ON "lookup_history" USING btree ("user_id","viewed_at");