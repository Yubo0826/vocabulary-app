CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dict_confusables" (
	"id" serial PRIMARY KEY NOT NULL,
	"headword_a" text NOT NULL,
	"headword_b" text NOT NULL,
	"method" text NOT NULL,
	"explanation" text,
	"model" text,
	"reviewed" boolean DEFAULT false NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"source" text DEFAULT 'generated' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dict_confusables_order_chk" CHECK ("dict_confusables"."headword_a" < "dict_confusables"."headword_b")
);
--> statement-breakpoint
CREATE TABLE "dict_definitions" (
	"id" serial PRIMARY KEY NOT NULL,
	"headword" text NOT NULL,
	"lang" text NOT NULL,
	"pos" text,
	"text" text NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"source" text NOT NULL,
	"source_ref" text
);
--> statement-breakpoint
CREATE TABLE "dict_entries" (
	"headword" text PRIMARY KEY NOT NULL,
	"display" text NOT NULL,
	"phonetic" text,
	"frequency_rank" integer,
	"tags" text[],
	"source" text NOT NULL,
	"source_ref" text
);
--> statement-breakpoint
CREATE TABLE "dict_example_words" (
	"headword" text NOT NULL,
	"example_id" integer NOT NULL,
	"score" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "dict_example_words_headword_example_id_pk" PRIMARY KEY("headword","example_id")
);
--> statement-breakpoint
CREATE TABLE "dict_examples" (
	"id" serial PRIMARY KEY NOT NULL,
	"text_en" text NOT NULL,
	"text_zh" text,
	"en_sentence_id" integer NOT NULL,
	"zh_sentence_id" integer,
	"en_author" text,
	"zh_author" text,
	"en_license" text NOT NULL,
	"zh_license" text,
	"source" text DEFAULT 'tatoeba' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dict_word_forms" (
	"form" text NOT NULL,
	"lemma" text NOT NULL,
	"kind" text NOT NULL,
	CONSTRAINT "dict_word_forms_form_lemma_kind_pk" PRIMARY KEY("form","lemma","kind")
);
--> statement-breakpoint
CREATE TABLE "cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"headword" text NOT NULL,
	"direction" text DEFAULT 'en_zh' NOT NULL,
	"due" timestamp with time zone NOT NULL,
	"stability" double precision DEFAULT 0 NOT NULL,
	"difficulty" double precision DEFAULT 0 NOT NULL,
	"scheduled_days" integer DEFAULT 0 NOT NULL,
	"learning_steps" integer DEFAULT 0 NOT NULL,
	"reps" integer DEFAULT 0 NOT NULL,
	"lapses" integer DEFAULT 0 NOT NULL,
	"state" smallint DEFAULT 0 NOT NULL,
	"last_review" timestamp with time zone,
	"suspended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "review_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"card_id" uuid NOT NULL,
	"rating" smallint NOT NULL,
	"state" smallint NOT NULL,
	"due" timestamp with time zone NOT NULL,
	"stability" double precision NOT NULL,
	"difficulty" double precision NOT NULL,
	"scheduled_days" integer NOT NULL,
	"learning_steps" integer DEFAULT 0 NOT NULL,
	"reviewed_at" timestamp with time zone NOT NULL,
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_words" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"headword" text NOT NULL,
	"note" text,
	"origin" text,
	"context_url" text,
	"context_sentence" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"desired_retention" real DEFAULT 0.9 NOT NULL,
	"maximum_interval" integer DEFAULT 36500 NOT NULL,
	"fsrs_weights" jsonb,
	"new_cards_per_day" integer DEFAULT 20 NOT NULL,
	"day_starts_at_hour" smallint DEFAULT 4 NOT NULL,
	"timezone" text DEFAULT 'Asia/Taipei' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wordbook_items" (
	"wordbook_id" uuid NOT NULL,
	"saved_word_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "wordbook_items_wordbook_id_saved_word_id_pk" PRIMARY KEY("wordbook_id","saved_word_id")
);
--> statement-breakpoint
CREATE TABLE "wordbooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dict_confusables" ADD CONSTRAINT "dict_confusables_headword_a_dict_entries_headword_fk" FOREIGN KEY ("headword_a") REFERENCES "public"."dict_entries"("headword") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dict_confusables" ADD CONSTRAINT "dict_confusables_headword_b_dict_entries_headword_fk" FOREIGN KEY ("headword_b") REFERENCES "public"."dict_entries"("headword") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dict_definitions" ADD CONSTRAINT "dict_definitions_headword_dict_entries_headword_fk" FOREIGN KEY ("headword") REFERENCES "public"."dict_entries"("headword") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dict_example_words" ADD CONSTRAINT "dict_example_words_headword_dict_entries_headword_fk" FOREIGN KEY ("headword") REFERENCES "public"."dict_entries"("headword") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dict_example_words" ADD CONSTRAINT "dict_example_words_example_id_dict_examples_id_fk" FOREIGN KEY ("example_id") REFERENCES "public"."dict_examples"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_logs" ADD CONSTRAINT "review_logs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_logs" ADD CONSTRAINT "review_logs_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_words" ADD CONSTRAINT "saved_words_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wordbook_items" ADD CONSTRAINT "wordbook_items_wordbook_id_wordbooks_id_fk" FOREIGN KEY ("wordbook_id") REFERENCES "public"."wordbooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wordbook_items" ADD CONSTRAINT "wordbook_items_saved_word_id_saved_words_id_fk" FOREIGN KEY ("saved_word_id") REFERENCES "public"."saved_words"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wordbook_items" ADD CONSTRAINT "wordbook_items_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wordbooks" ADD CONSTRAINT "wordbooks_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "dict_confusables_pair_idx" ON "dict_confusables" USING btree ("headword_a","headword_b");--> statement-breakpoint
CREATE INDEX "dict_confusables_b_idx" ON "dict_confusables" USING btree ("headword_b");--> statement-breakpoint
CREATE INDEX "dict_definitions_headword_idx" ON "dict_definitions" USING btree ("headword","lang","sort_order");--> statement-breakpoint
CREATE INDEX "dict_entries_headword_trgm_idx" ON "dict_entries" USING gin ("headword" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "dict_entries_headword_prefix_idx" ON "dict_entries" USING btree ("headword" text_pattern_ops);--> statement-breakpoint
CREATE INDEX "dict_entries_freq_idx" ON "dict_entries" USING btree ("frequency_rank");--> statement-breakpoint
CREATE INDEX "dict_example_words_rank_idx" ON "dict_example_words" USING btree ("headword","score");--> statement-breakpoint
CREATE UNIQUE INDEX "dict_examples_pair_idx" ON "dict_examples" USING btree ("en_sentence_id","zh_sentence_id");--> statement-breakpoint
CREATE INDEX "dict_word_forms_lemma_idx" ON "dict_word_forms" USING btree ("lemma");--> statement-breakpoint
CREATE UNIQUE INDEX "cards_user_headword_dir_idx" ON "cards" USING btree ("user_id","headword","direction");--> statement-breakpoint
CREATE INDEX "cards_user_due_idx" ON "cards" USING btree ("user_id","due");--> statement-breakpoint
CREATE INDEX "cards_user_updated_idx" ON "cards" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "review_logs_card_idx" ON "review_logs" USING btree ("card_id","reviewed_at");--> statement-breakpoint
CREATE INDEX "review_logs_user_reviewed_idx" ON "review_logs" USING btree ("user_id","reviewed_at");--> statement-breakpoint
CREATE INDEX "review_logs_user_created_idx" ON "review_logs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "saved_words_user_headword_idx" ON "saved_words" USING btree ("user_id","headword");--> statement-breakpoint
CREATE INDEX "saved_words_user_updated_idx" ON "saved_words" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "wordbook_items_user_updated_idx" ON "wordbook_items" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "wordbooks_user_updated_idx" ON "wordbooks" USING btree ("user_id","updated_at");