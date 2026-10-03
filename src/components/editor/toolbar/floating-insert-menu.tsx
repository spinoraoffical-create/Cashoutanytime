"use client";

import { FloatingMenu } from "@tiptap/react/menus";
import type { Editor } from "@tiptap/core";
import { Plus } from "lucide-react";

export function FloatingInsertMenu({ editor }: { editor: Editor }) {
  return (
    <FloatingMenu editor={editor} className="flex items-center">
      <button
        type="button"
        aria-label="Insert block"
        title="Insert block"
        onClick={() => editor.chain().focus().insertContent("/").run()}
        className="flex size-7 items-center justify-center rounded-md border border-border bg-popover text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        <Plus className="size-4" aria-hidden />
      </button>
    </FloatingMenu>
  );
}
