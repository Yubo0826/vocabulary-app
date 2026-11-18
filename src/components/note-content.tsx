/**
 * 把筆記（Markdown）渲染成 React 元素，在伺服器端執行，不送編輯器到前端。
 * 解析與編輯器（note-editor.tsx）共用 Tiptap 的 Markdown 規則，兩邊看到的格式一致。
 * 不使用 dangerouslySetInnerHTML：筆記裡的 HTML 一律當文字；連結只允許 http(s) 與 mailto；顏色只套固定色盤的 class。
 */
import type { JSONContent } from "@tiptap/core";
import { MarkdownManager } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";
import { Fragment, type ReactNode } from "react";
import { noteColorClass } from "@/lib/note-color";
import { NOTE_MARKDOWN_EXTENSIONS } from "@/lib/note-markdown";
import { cn } from "@/lib/utils";

const parser = new MarkdownManager({
  extensions: [StarterKit.configure({ underline: false }), ...NOTE_MARKDOWN_EXTENSIONS],
});

const SAFE_HREF = /^(https?:|mailto:)/i;

function withMarks(text: ReactNode, marks: JSONContent["marks"] = []): ReactNode {
  return marks.reduce<ReactNode>((inner, mark) => {
    switch (mark.type) {
      case "bold":
        return <strong>{inner}</strong>;
      case "italic":
        return <em>{inner}</em>;
      case "code":
        return <code>{inner}</code>;
      case "strike":
        return <s>{inner}</s>;
      case "link": {
        const href = String(mark.attrs?.href ?? "");
        return SAFE_HREF.test(href) ? (
          <a href={href} target="_blank" rel="noopener noreferrer nofollow">
            {inner}
          </a>
        ) : (
          inner
        );
      }
      case "noteColor":
      case "noteBg": {
        const className = noteColorClass(mark.type, mark.attrs?.color);
        return className ? <span className={className}>{inner}</span> : inner;
      }
      default:
        return inner;
    }
  }, text);
}

function renderNode(node: JSONContent, key: number): ReactNode {
  const children = node.content?.map(renderNode);
  switch (node.type) {
    case "text":
      return <Fragment key={key}>{withMarks(node.text ?? "", node.marks)}</Fragment>;
    case "paragraph":
      return <p key={key}>{children}</p>;
    case "bulletList":
      return <ul key={key}>{children}</ul>;
    case "orderedList":
      return (
        <ol key={key} start={typeof node.attrs?.start === "number" ? node.attrs.start : undefined}>
          {children}
        </ol>
      );
    case "listItem":
      return <li key={key}>{children}</li>;
    case "heading": {
      // 筆記嵌在頁面的區塊裡，標題降成 h3／h4，不打亂頁面本身的標題層級。
      // 樣式與編輯器一致：H1、H2 是「標題」，H3 以下是「小標題」
      const small = typeof node.attrs?.level === "number" && node.attrs.level >= 3;
      return small ? (
        <h4 key={key} className="note-h-sm">
          {children}
        </h4>
      ) : (
        <h3 key={key} className="note-h-lg">
          {children}
        </h3>
      );
    }
    case "blockquote":
      return <blockquote key={key}>{children}</blockquote>;
    case "codeBlock":
      return (
        <pre key={key}>
          <code>{children}</code>
        </pre>
      );
    case "table": // 外層可以橫向捲動，窄螢幕不會撐破版面
      return (
        <div key={key} className="note-table">
          <table>
            <tbody>{children}</tbody>
          </table>
        </div>
      );
    case "tableRow":
      return <tr key={key}>{children}</tr>;
    case "tableHeader":
    case "tableCell": {
      const align = node.attrs?.align;
      const style = align === "left" || align === "center" || align === "right" ? { textAlign: align } : undefined;
      return node.type === "tableHeader" ? (
        <th key={key} scope="col" style={style}>
          {children}
        </th>
      ) : (
        <td key={key} style={style}>
          {children}
        </td>
      );
    }
    case "horizontalRule":
      return <hr key={key} />;
    case "hardBreak":
      return <br key={key} />;
    default: // doc 與未知節點：只渲染內容
      return <Fragment key={key}>{children}</Fragment>;
  }
}

export function NoteContent({ markdown: source, className }: { markdown: string; className?: string }) {
  return <div className={cn("note-content wrap-anywhere", className)}>{renderNode(parser.parse(source), 0)}</div>;
}
