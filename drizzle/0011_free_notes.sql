ALTER TABLE "word_notes" ALTER COLUMN "headword" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "word_notes" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "word_notes" ADD CONSTRAINT "word_notes_word_or_title" CHECK ("word_notes"."headword" IS NOT NULL OR "word_notes"."title" IS NOT NULL);