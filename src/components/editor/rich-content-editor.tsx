"use client";

import { useEffect, useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";

import { cn } from "@/lib/utils";
import { docToMarkdown } from "@/lib/editor/markdown";
import { getEditorExtensions } from "./extensions";
import { RceStorageExtension } from "./rce-storage";
import { BubbleToolbar } from "./toolbar/bubble-toolbar";
import { FloatingInsertMenu } from "./toolbar/floating-insert-menu";

export interface RichContentEditorProps {
  /** Initial content as a markdown string — used only to seed the editor at mount. */
  content: string;
  onChange: (markdown: string) => void;
  /** Omit to fall back to a plain "Image URL" prompt instead of file upload. */
  onUploadImage?: (file: File) => Promise<string>;
  placeholder?: string;
  editable?: boolean;
  className?: string;
  autofocus?: boolean;
}

function insertUploadedImage(view: import("@tiptap/pm/view").EditorView, pos: number, src: string) {
  const node = view.state.schema.nodes.image.create({ src });
  view.dispatch(view.state.tr.insert(pos, node));
}

export function RichContentEditor({
  content,
  onChange,
  onUploadImage,
  placeholder,
  editable = true,
  className,
  autofocus = false,
}: RichContentEditorProps) {
  const uploadRef = useRef(onUploadImage);
  uploadRef.current = onUploadImage;

  const editor = useEditor({
    extensions: [...getEditorExtensions({ placeholder }), RceStorageExtension],
    content,
    contentType: "markdown",
    editable,
    autofocus,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn(
          "prose-blog max-w-none focus:outline-none min-h-[16rem] px-1 py-2",
          className
        ),
      },
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false;
        const file = event.dataTransfer?.files?.[0];
        const upload = uploadRef.current;
        if (!file || !file.type.startsWith("image/") || !upload) return false;
        event.preventDefault();
        const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
        upload(file).then((src) => insertUploadedImage(view, coords?.pos ?? view.state.selection.from, src));
        return true;
      },
      handlePaste: (view, event) => {
        const file = Array.from(event.clipboardData?.files ?? []).find((f) =>
          f.type.startsWith("image/")
        );
        const upload = uploadRef.current;
        if (!file || !upload) return false;
        event.preventDefault();
        upload(file).then((src) => insertUploadedImage(view, view.state.selection.from, src));
        return true;
      },
    },
    onUpdate: ({ editor }) => onChange(docToMarkdown(editor)),
  }, []);

  useEffect(() => {
    if (editor) editor.storage.rce.onUploadImage = onUploadImage;
  }, [editor, onUploadImage]);

  useEffect(() => {
    if (editor && editor.isEditable !== editable) editor.setEditable(editable);
  }, [editor, editable]);

  if (!editor) return null;

  return (
    <div className="rich-content-editor">
      <BubbleToolbar editor={editor} />
      <FloatingInsertMenu editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
