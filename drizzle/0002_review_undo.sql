ALTER TABLE "review_logs" ADD COLUMN "last_review" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "review_logs" ADD COLUMN "undone_at" timestamp with time zone;