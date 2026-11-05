CREATE TABLE "dict_similar_words" (
	"headword" text NOT NULL,
	"kind" text NOT NULL,
	"word" text NOT NULL,
	"rank" smallint NOT NULL,
	"source" text NOT NULL,
	CONSTRAINT "dict_similar_words_headword_kind_word_pk" PRIMARY KEY("headword","kind","word")
);
--> statement-breakpoint
ALTER TABLE "dict_similar_words" ADD CONSTRAINT "dict_similar_words_headword_dict_entries_headword_fk" FOREIGN KEY ("headword") REFERENCES "public"."dict_entries"("headword") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dict_similar_words" ADD CONSTRAINT "dict_similar_words_word_dict_entries_headword_fk" FOREIGN KEY ("word") REFERENCES "public"."dict_entries"("headword") ON DELETE cascade ON UPDATE no action;