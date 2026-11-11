"use client";

/**
 * 筆記編輯器（Tiptap）：上方一排精簡工具列，存成 Markdown 字串。
 * 檔案較大，由 note-dialog 以 next/dynamic 在打開視窗時才載入。
 */
import { Markdown } from "@tiptap/markdown";
import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, Link2, List, ListOrdered, Redo2, Undo2, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * 打字自動轉格式只保留編號清單：打「1. 」轉成清單，Enter 產生下一項，在空的項目上 Enter 結束清單。
 * 其他格式用工具列套用。標題、引言、程式碼區塊仍然載入，舊筆記裡的這些語法才不會在存檔時被吃掉。
 */
const SHORTCUTS = ["orderedList"];

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
        // 像 Notion 一樣沒有外框，直接在視窗裡書寫
        class: "note-content max-h-[60vh] min-h-60 w-full overflow-y-auto py-1 text-base wrap-anywhere outline-none md:text-sm",
      },
    },
    onUpdate: ({ editor }) => onChange(unescapeEntities(editor.getMarkdown())),
  });

  return (
    <div className="flex flex-col gap-3">
      {editor && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  // 只在這些狀態改變時重新渲染工具列，打字時不必每次都更新
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      orderedList: e.isActive("orderedList"),
      bulletList: e.isActive("bulletList"),
      link: e.isActive("link"),
    }),
  });
  const run = () => editor.chain().focus();

  return (
    <div role="toolbar" aria-label="筆記格式" className="-mx-1 flex items-center gap-0.5 border-b pb-2">
      <ToolButton icon={Undo2} label="復原" disabled={!state.canUndo} onClick={() => run().undo().run()} />
      <ToolButton icon={Redo2} label="重做" disabled={!state.canRedo} onClick={() => run().redo().run()} />
      <Divider />
      <ToolButton icon={Bold} label="粗體" active={state.bold} onClick={() => run().toggleBold().run()} />
      <ToolButton icon={Italic} label="斜體" active={state.italic} onClick={() => run().toggleItalic().run()} />
      <Divider />
      <ToolButton icon={ListOrdered} label="編號清單" active={state.orderedList} onClick={() => run().toggleOrderedList().run()} />
      <ToolButton icon={List} label="項目清單" active={state.bulletList} onClick={() => run().toggleBulletList().run()} />
      <Divider />
      <LinkButton editor={editor} active={state.link} />
    </div>
  );
}

function ToolButton({
  icon: Icon,
  label,
  active,
  disabled,
  onClick,
  ...props
}: { icon: LucideIcon; label: string; active?: boolean } & React.ComponentProps<typeof Button>) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn("text-muted-foreground", active && "bg-accent text-accent-foreground hover:bg-accent")}
      {...props}
    >
      <Icon />
    </Button>
  );
}

function Divider() {
  return <span className="mx-1 h-4 w-px bg-border" aria-hidden />;
}

/** 連結：小視窗輸入網址。有選取文字就把它變成連結；沒選取就直接插入網址 */
function LinkButton({ editor, active }: { editor: Editor; active: boolean }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");

  const onOpenChange = (next: boolean) => {
    if (next) setUrl(String(editor.getAttributes("link").href ?? ""));
    setOpen(next);
  };

  const apply = () => {
    const raw = url.trim();
    const chain = editor.chain().focus().extendMarkRange("link");
    if (!raw) {
      chain.unsetLink().run();
    } else {
      const href = /^(https?:|mailto:)/i.test(raw) ? raw : `https://${raw}`;
      if (editor.state.selection.empty && !active) {
        chain.insertContent({ type: "text", text: raw, marks: [{ type: "link", attrs: { href } }] }).run();
      } else {
        chain.setLink({ href }).run();
      }
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <ToolButton icon={Link2} label="連結" active={active} />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <form
          className="flex gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            apply();
          }}
        >
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="貼上網址"
            aria-label="網址"
            inputMode="url"
            autoFocus
            className="h-8 text-base md:text-sm"
          />
          <Button type="submit" size="sm">
            {url.trim() || !active ? "套用" : "移除"}
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
