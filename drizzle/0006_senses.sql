CREATE TABLE "dict_senses" (
	"id" serial PRIMARY KEY NOT NULL,
	"headword" text NOT NULL,
	"sense_order" smallint NOT NULL,
	"pos" text,
	"label_zh" text NOT NULL,
	"gloss_en" text,
	"wordnet_synsets" text[],
	"source" text DEFAULT 'llm' NOT NULL,
	"model" text
);
--> statement-breakpoint
ALTER TABLE "dict_example_words" ADD COLUMN "sense_id" integer;--> statement-breakpoint
ALTER TABLE "dict_examples" ADD COLUMN "text_zh_revised" text;--> statement-breakpoint
ALTER TABLE "dict_examples" ADD COLUMN "zh_revised_model" text;--> statement-breakpoint
ALTER TABLE "dict_senses" ADD CONSTRAINT "dict_senses_headword_dict_entries_headword_fk" FOREIGN KEY ("headword") REFERENCES "public"."dict_entries"("headword") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "dict_senses_headword_order_idx" ON "dict_senses" USING btree ("headword","sense_order");--> statement-breakpoint
ALTER TABLE "dict_example_words" ADD CONSTRAINT "dict_example_words_sense_id_dict_senses_id_fk" FOREIGN KEY ("sense_id") REFERENCES "public"."dict_senses"("id") ON DELETE set null ON UPDATE no action;