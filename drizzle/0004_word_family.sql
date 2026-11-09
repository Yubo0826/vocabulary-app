CREATE TABLE "dict_word_family" (
	"headword" text NOT NULL,
	"word" text NOT NULL,
	"pos" text NOT NULL,
	"rank" smallint NOT NULL,
	"source" text NOT NULL,
	CONSTRAINT "dict_word_family_headword_word_pk" PRIMARY KEY("headword","word")
);
--> statement-breakpoint
ALTER TABLE "dict_word_family" ADD CONSTRAINT "dict_word_family_headword_dict_entries_headword_fk" FOREIGN KEY ("headword") REFERENCES "public"."dict_entries"("headword") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dict_word_family" ADD CONSTRAINT "dict_word_family_word_dict_entries_headword_fk" FOREIGN KEY ("word") REFERENCES "public"."dict_entries"("headword") ON DELETE cascade ON UPDATE no action;