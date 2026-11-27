CREATE TABLE "note_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT 'gray' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "word_note_tags" (
	"note_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "word_note_tags_note_id_tag_id_pk" PRIMARY KEY("note_id","tag_id")
);
--> statement-breakpoint
ALTER TABLE "note_tags" ADD CONSTRAINT "note_tags_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "word_note_tags" ADD CONSTRAINT "word_note_tags_note_id_word_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."word_notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "word_note_tags" ADD CONSTRAINT "word_note_tags_tag_id_note_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."note_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "word_note_tags" ADD CONSTRAINT "word_note_tags_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "note_tags_user_name_idx" ON "note_tags" USING btree ("user_id",lower("name")) WHERE "note_tags"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "note_tags_user_updated_idx" ON "note_tags" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "word_note_tags_tag_idx" ON "word_note_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "word_note_tags_user_updated_idx" ON "word_note_tags" USING btree ("user_id","updated_at");