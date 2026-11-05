/**
 * 把筆記（Markdown）渲染成 React 元素，在伺服器端執行，不送編輯器到前端。
 * 解析與編輯器（note-editor.tsx）共用 Tiptap 的 Markdown 規則，兩邊看到的格式一致。
 * 不使用 dangerouslySetInnerHTML：筆記裡的 HTML 一律當文字；連結只允許 http(s) 與 mailto。
 */
import type { JSONContent } from "@tiptap/core";
import { MarkdownManager } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";
import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const parser = new MarkdownManager({ extensions: [StarterKit.configure({ underline: false })] });

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
    case "heading": // 筆記不需要大字標題，顯示成粗體段落
      return (
        <p key={key}>
          <strong>{children}</strong>
        </p>
      );
    case "blockquote":
      return <blockquote key={key}>{children}</blockquote>;
    case "codeBlock":
      return (
        <pre key={key}>
          <code>{children}</code>
        </pre>
      );
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
