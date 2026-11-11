ALTER TABLE "dict_examples" ALTER COLUMN "en_sentence_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "dict_examples" ALTER COLUMN "en_license" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "dict_examples" ADD COLUMN "model" text;