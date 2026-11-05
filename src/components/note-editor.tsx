"use client";

/**
 * 筆記編輯器（Tiptap）：邊打邊套用 Markdown 格式，存成 Markdown 字串。
 * 檔案較大，由 note-dialog 以 next/dynamic 在打開視窗時才載入。
 */
import { Markdown } from "@tiptap/markdown";
import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

/**
 * 只有這些格式有輸入快捷（打 **x**、- 等會自動轉換）。
 * 標題、引言、程式碼區塊、刪除線仍然載入，只是不提供快捷：
 * 筆記裡若有這些語法（例如貼上或舊資料）才不會在存檔時被吃掉。
 */
const SHORTCUTS = ["bold", "italic", "code", "link", "bulletList", "orderedList"];

/** 序列化時 < > & 會被轉成 HTML 實體；筆記一律當純文字，轉回原字元（不會被當成 HTML 渲染） */
const unescapeEntities = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

type Props = {
  initial: string;
  placeholder: string;
  onChange: (markdown: string) => void;
};

export default function NoteEditor({ initial, placeholder, onChange }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        underline: false, // Markdown 沒有底線語法，存檔會遺失
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: "https",
          HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
        },
      }),
      Markdown,
      Placeholder.configure({ placeholder }),
    ],
    content: initial,
    contentType: "markdown",
    enableInputRules: SHORTCUTS,
    enablePasteRules: SHORTCUTS,
    immediatelyRender: false,
    autofocus: "end",
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": "筆記",
        class:
          "note-content max-h-[50vh] min-h-32 w-full overflow-y-auto rounded-lg border border-input bg-transparent px-2.5 py-2 text-base wrap-anywhere transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30",
      },
    },
    onUpdate: ({ editor }) => onChange(unescapeEntities(editor.getMarkdown())),
  });

  return <EditorContent editor={editor} />;
}
