"use client";

/**
 * 筆記編輯器（Tiptap）：上方一排精簡工具列，存成 Markdown 字串。
 * 檔案較大，由 note-dialog 以 next/dynamic 在打開視窗時才載入。
 */
import { TableKit } from "@tiptap/extension-table";
import { Markdown } from "@tiptap/markdown";
import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Ban,
  BetweenHorizontalEnd,
  BetweenHorizontalStart,
  BetweenVerticalEnd,
  BetweenVerticalStart,
  Bold,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Palette,
  Redo2,
  Table,
  Trash2,
  Underline,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { NOTE_BG_COLORS, NOTE_TEXT_COLORS, noteColorClass } from "@/lib/note-color";
import { NOTE_MARKDOWN_EXTENSIONS } from "@/lib/note-markdown";
import { cn } from "@/lib/utils";

/**
 * 打字自動轉格式只保留編號清單：打「1. 」轉成清單，Enter 產生下一項，在空的項目上 Enter 結束清單。
 * 其他格式用工具列套用（標題只開放 H2「標題」與 H3「小標題」）。
 * 引言、程式碼區塊與其他層級的標題仍然載入，舊筆記裡的這些語法才不會在存檔時被吃掉。
 */
const SHORTCUTS = ["orderedList"];

/**
 * 表格（GFM 語法）：第一列固定是表頭，不能合併儲存格，儲存格裡只能放單行文字（換行存成 `<br>`）。
 * 不開放拖拉欄寬（Markdown 存不了）；renderWrapper 讓表格外面多一層可以橫向捲動的容器。
 * 顯示端不載入 TableKit，改用 lib/note-table-parse.ts，解析結果相同。
 */
const NoteTable = TableKit.configure({ table: { resizable: false, renderWrapper: true } });

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
        // 底線：Markdown 沒有底線語法，Tiptap 存成 <u>…</u>，並自帶讀取規則（顯示端也讀得回來）
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: "https",
          HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
        },
      }),
      ...NOTE_MARKDOWN_EXTENSIONS,
      NoteTable,
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
      underline: e.isActive("underline"),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      orderedList: e.isActive("orderedList"),
      bulletList: e.isActive("bulletList"),
      link: e.isActive("link"),
      color: (e.getAttributes("noteColor").color as string | undefined) ?? null,
      bg: (e.getAttributes("noteBg").color as string | undefined) ?? null,
      inTable: e.isActive("table"),
      inHeader: e.isActive("tableHeader"),
    }),
  });
  const run = () => editor.chain().focus();

  return (
    <div role="toolbar" aria-label="筆記格式" className="-mx-1 flex flex-wrap items-center gap-0.5 border-b pb-2">
      <ToolButton icon={Undo2} label="復原" disabled={!state.canUndo} onClick={() => run().undo().run()} />
      <ToolButton icon={Redo2} label="重做" disabled={!state.canRedo} onClick={() => run().redo().run()} />
      <Divider />
      <ToolButton icon={Heading2} label="標題" active={state.h2} onClick={() => run().toggleHeading({ level: 2 }).run()} />
      <ToolButton icon={Heading3} label="小標題" active={state.h3} onClick={() => run().toggleHeading({ level: 3 }).run()} />
      <Divider />
      <ToolButton icon={Bold} label="粗體" active={state.bold} onClick={() => run().toggleBold().run()} />
      <ToolButton icon={Italic} label="斜體" active={state.italic} onClick={() => run().toggleItalic().run()} />
      <ToolButton
        icon={Underline}
        label="底線"
        active={state.underline}
        onClick={() => run().toggleUnderline().run()}
      />
      <ColorButton editor={editor} color={state.color} bg={state.bg} />
      <Divider />
      <ToolButton icon={ListOrdered} label="編號清單" active={state.orderedList} onClick={() => run().toggleOrderedList().run()} />
      <ToolButton icon={List} label="項目清單" active={state.bulletList} onClick={() => run().toggleBulletList().run()} />
      <Divider />
      <LinkButton editor={editor} active={state.link} />
      <TableMenu editor={editor} inTable={state.inTable} inHeader={state.inHeader} />
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

/**
 * 文字色與底色：小視窗裡兩排色塊，各有一個「無」。套用在選取的文字上；沒有選取時套用到接下來輸入的字。
 * 選完不關視窗，方便同時設定文字色和底色。
 */
function ColorButton({ editor, color, bg }: { editor: Editor; color: string | null; bg: string | null }) {
  const apply = (mark: "noteColor" | "noteBg", value: string | null) => {
    const chain = editor.chain().focus();
    (value ? chain.setMark(mark, { color: value }) : chain.unsetMark(mark)).run();
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <ToolButton icon={Palette} label="文字顏色" active={!!(color || bg)} />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto gap-3 p-3">
        <SwatchRow
          title="文字色"
          mark="noteColor"
          colors={NOTE_TEXT_COLORS}
          current={color}
          onPick={(v) => apply("noteColor", v)}
        />
        <SwatchRow title="底色" mark="noteBg" colors={NOTE_BG_COLORS} current={bg} onPick={(v) => apply("noteBg", v)} />
      </PopoverContent>
    </Popover>
  );
}

function SwatchRow({
  title,
  mark,
  colors,
  current,
  onPick,
}: {
  title: string;
  mark: "noteColor" | "noteBg";
  colors: readonly { name: string; label: string }[];
  current: string | null;
  onPick: (color: string | null) => void;
}) {
  const swatch =
    "flex size-8 items-center justify-center rounded-md border border-input text-sm font-semibold transition-colors hover:border-foreground/50 aria-pressed:ring-2 aria-pressed:ring-primary aria-pressed:ring-offset-1 aria-pressed:ring-offset-popover";
  return (
    <div role="group" aria-label={title} className="flex flex-col gap-1.5">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <div className="flex gap-1.5">
        <button
          type="button"
          aria-label={`${title}：無`}
          title="無"
          aria-pressed={current === null}
          onClick={() => onPick(null)}
          className={cn(swatch, "text-muted-foreground")}
        >
          <Ban className="size-4" aria-hidden />
        </button>
        {colors.map((c) => (
          <button
            key={c.name}
            type="button"
            aria-label={`${title}：${c.label}`}
            title={c.label}
            aria-pressed={current === c.name}
            onClick={() => onPick(c.name)}
            className={cn(swatch, noteColorClass(mark, c.name), "p-0")}
          >
            <span aria-hidden>A</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * 表格：不在表格裡時只能插入（3×3，第一列是表頭）；游標在表格裡時可以增刪列、欄或整個表格。
 * 表頭列不能刪：Markdown 表格一定有表頭，刪了存檔後會多出一列空白表頭。
 */
function TableMenu({ editor, inTable, inHeader }: { editor: Editor; inTable: boolean; inHeader: boolean }) {
  const run = () => editor.chain().focus();
  const items: { icon: LucideIcon; label: string; action: () => void; disabled?: boolean; destructive?: boolean }[] = [
    { icon: BetweenHorizontalStart, label: "上方插入列", action: () => run().addRowBefore().run(), disabled: inHeader },
    { icon: BetweenHorizontalEnd, label: "下方插入列", action: () => run().addRowAfter().run() },
    { icon: BetweenVerticalStart, label: "左側插入欄", action: () => run().addColumnBefore().run() },
    { icon: BetweenVerticalEnd, label: "右側插入欄", action: () => run().addColumnAfter().run() },
  ];
  const deletions: typeof items = [
    { icon: Minus, label: "刪除這一列", action: () => run().deleteRow().run(), disabled: inHeader },
    { icon: Minus, label: "刪除這一欄", action: () => run().deleteColumn().run() },
    { icon: Trash2, label: "刪除表格", action: () => run().deleteTable().run(), destructive: true },
  ];

  if (!inTable) {
    return (
      <ToolButton
        icon={Table}
        label="插入表格"
        onClick={() => run().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
      />
    );
  }
  const render = (list: typeof items) =>
    list.map(({ icon: Icon, label, action, disabled, destructive }) => (
      <DropdownMenuItem key={label} disabled={disabled} variant={destructive ? "destructive" : "default"} onSelect={action}>
        <Icon /> {label}
      </DropdownMenuItem>
    ));
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <ToolButton icon={Table} label="表格" active />
      </DropdownMenuTrigger>
      {/* 關閉時不要把焦點還給按鈕，讓游標留在編輯器裡 */}
      <DropdownMenuContent align="start" onCloseAutoFocus={(e) => e.preventDefault()}>
        {render(items)}
        <DropdownMenuSeparator />
        {render(deletions)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
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
