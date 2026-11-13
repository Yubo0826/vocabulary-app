CREATE TABLE "dict_entry_senses" (
	"id" serial PRIMARY KEY NOT NULL,
	"headword" text NOT NULL,
	"sense_order" smallint NOT NULL,
	"pos" text NOT NULL,
	"label_zh" text NOT NULL,
	"def_zh" text NOT NULL,
	"def_en" text NOT NULL,
	"usage" text NOT NULL,
	"register" text[] DEFAULT '{}'::text[] NOT NULL,
	"wordnet_synsets" text[],
	"source" text DEFAULT 'llm' NOT NULL,
	"model" text
);
--> statement-breakpoint
ALTER TABLE "dict_entry_senses" ADD CONSTRAINT "dict_entry_senses_headword_dict_entries_headword_fk" FOREIGN KEY ("headword") REFERENCES "public"."dict_entries"("headword") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "dict_entry_senses_headword_order_idx" ON "dict_entry_senses" USING btree ("headword","sense_order");