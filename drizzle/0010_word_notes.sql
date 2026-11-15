CREATE TABLE "word_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"headword" text NOT NULL,
	"note" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "word_notes" ADD CONSTRAINT "word_notes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "word_notes_user_headword_idx" ON "word_notes" USING btree ("user_id","headword");--> statement-breakpoint
CREATE INDEX "word_notes_user_updated_idx" ON "word_notes" USING btree ("user_id","updated_at");--> statement-breakpoint
-- 資料搬移 1：收藏中的字的筆記搬到 word_notes（saved_words.note 保留不刪）
INSERT INTO "word_notes" ("user_id", "headword", "note", "created_at", "updated_at")
SELECT "user_id", "headword", "note", "created_at", "updated_at"
FROM "saved_words"
WHERE "deleted_at" IS NULL AND "note" IS NOT NULL AND btrim("note") <> ''
ON CONFLICT ("user_id", "headword") DO NOTHING;--> statement-breakpoint
-- 資料搬移 2：收藏改成「至少在一本單字本裡」，沒放進任何單字本的收藏放進每位使用者新建的「未分類」
WITH orphans AS (
  SELECT sw."id", sw."user_id"
  FROM "saved_words" sw
  WHERE sw."deleted_at" IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM "wordbook_items" wi
      JOIN "wordbooks" w ON w."id" = wi."wordbook_id" AND w."deleted_at" IS NULL
      WHERE wi."saved_word_id" = sw."id" AND wi."deleted_at" IS NULL
    )
),
books AS (
  INSERT INTO "wordbooks" ("user_id", "name", "sort_order")
  SELECT u."user_id", '未分類',
    (SELECT coalesce(max(w."sort_order"), 0) + 1 FROM "wordbooks" w WHERE w."user_id" = u."user_id")
  FROM (SELECT DISTINCT "user_id" FROM orphans) u
  RETURNING "id", "user_id"
)
INSERT INTO "wordbook_items" ("wordbook_id", "saved_word_id", "user_id")
SELECT b."id", o."id", o."user_id"
FROM orphans o
JOIN books b ON b."user_id" = o."user_id";
