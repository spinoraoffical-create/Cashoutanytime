import type { Editor, Range } from "@tiptap/core";
import {
  Heading1,
  Heading2,
  Heading3,
  Pilcrow,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Minus,
  Code2,
  Table2,
  ImageIcon,
  Film,
  Info,
  CheckCircle2,
  TriangleAlert,
} from "lucide-react";

export interface SlashItem {
  title: string;
  description: string;
  icon: typeof Pilcrow;
  keywords?: string[];
  command: (opts: { editor: Editor; range: Range }) => void;
}

function insertImage(editor: Editor, range: Range) {
  editor.chain().focus().deleteRange(range).run();
  const onUploadImage = editor.storage.rce?.onUploadImage as
    | ((file: File) => Promise<string>)
    | undefined;

  if (onUploadImage) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const src = await onUploadImage(file);
      editor.chain().focus().setImage({ src }).run();
    };
    input.click();
    return;
  }

  const src = window.prompt("Image URL");
  if (src) editor.chain().focus().setImage({ src }).run();
}

export const SLASH_ITEMS: SlashItem[] = [
  {
    title: "Paragraph",
    description: "Plain text",
    icon: Pilcrow,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setParagraph().run(),
  },
  {
    title: "Heading 1",
    description: "Big section heading",
    icon: Heading1,
    keywords: ["h1", "title"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 1 }).run(),
  },
  {
    title: "Heading 2",
    description: "Medium section heading",
    icon: Heading2,
    keywords: ["h2"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 2 }).run(),
  },
  {
    title: "Heading 3",
    description: "Small section heading",
    icon: Heading3,
    keywords: ["h3"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 3 }).run(),
  },
  {
    title: "Bullet list",
    description: "Unordered list",
    icon: List,
    keywords: ["ul", "bullet"],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    title: "Numbered list",
    description: "Ordered list",
    icon: ListOrdered,
    keywords: ["ol", "ordered"],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    title: "Checklist",
    description: "Task list with checkboxes",
    icon: ListChecks,
    keywords: ["todo", "task"],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  {
    title: "Quote",
    description: "Blockquote",
    icon: Quote,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setBlockquote().run(),
  },
  {
    title: "Divider",
    description: "Horizontal rule",
    icon: Minus,
    keywords: ["hr", "line"],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
  {
    title: "Code block",
    description: "Syntax-highlighted code",
    icon: Code2,
    keywords: ["code"],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    title: "Table",
    description: "3×3 table",
    icon: Table2,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    title: "Image",
    description: "Upload or embed an image",
    icon: ImageIcon,
    command: ({ editor, range }) => insertImage(editor, range),
  },
  {
    title: "Video",
    description: "Embed a YouTube or Vimeo URL",
    icon: Film,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      const src = window.prompt("YouTube or Vimeo URL");
      if (src) editor.chain().focus().setVideoEmbed({ src }).run();
    },
  },
  {
    title: "Callout",
    description: "Highlighted info box",
    icon: Info,
    keywords: ["info", "box"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setCallout({ type: "info" }).run(),
  },
  {
    title: "Success box",
    description: "Green highlighted box",
    icon: CheckCircle2,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setCallout({ type: "success" }).run(),
  },
  {
    title: "Warning box",
    description: "Amber highlighted box",
    icon: TriangleAlert,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setCallout({ type: "warning" }).run(),
  },
];

export function filterSlashItems(query: string): SlashItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return SLASH_ITEMS;
  return SLASH_ITEMS.filter(
    (item) =>
      item.title.toLowerCase().includes(q) ||
      item.keywords?.some((k) => k.includes(q))
  );
}
