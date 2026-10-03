"use client";

import { useState } from "react";
import { BubbleMenu } from "@tiptap/react/menus";
import type { Editor } from "@tiptap/core";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Highlighter,
  Link2,
  Link2Off,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Toggle } from "@/components/ui/toggle";
import { Separator } from "@/components/ui/separator";

function ToolbarToggle({
  pressed,
  onClick,
  label,
  icon: Icon,
}: {
  pressed: boolean;
  onClick: () => void;
  label: string;
  icon: typeof Bold;
}) {
  return (
    <Toggle size="sm" pressed={pressed} onPressedChange={onClick} aria-label={label}>
      <Icon className="size-3.5" aria-hidden />
    </Toggle>
  );
}

export function BubbleToolbar({ editor }: { editor: Editor }) {
  const [linkEditing, setLinkEditing] = useState(false);
  const [linkValue, setLinkValue] = useState("");

  function applyLink() {
    const url = linkValue.trim();
    if (url) {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
    setLinkEditing(false);
    setLinkValue("");
  }

  return (
    <BubbleMenu
      editor={editor}
      className={cn(
        "flex items-center gap-0.5 rounded-lg border border-border bg-popover p-1 shadow-lg"
      )}
      shouldShow={({ state }) => !state.selection.empty}
    >
      {linkEditing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            applyLink();
          }}
          className="flex items-center gap-1 px-1"
        >
          <input
            autoFocus
            value={linkValue}
            onChange={(e) => setLinkValue(e.target.value)}
            placeholder="https://…"
            className="h-7 w-44 rounded border border-border bg-background px-2 text-xs outline-none"
          />
        </form>
      ) : (
        <>
          <ToolbarToggle
            pressed={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
            label="Bold"
            icon={Bold}
          />
          <ToolbarToggle
            pressed={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            label="Italic"
            icon={Italic}
          />
          <ToolbarToggle
            pressed={editor.isActive("underline")}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            label="Underline"
            icon={Underline}
          />
          <ToolbarToggle
            pressed={editor.isActive("strike")}
            onClick={() => editor.chain().focus().toggleStrike().run()}
            label="Strikethrough"
            icon={Strikethrough}
          />
          <ToolbarToggle
            pressed={editor.isActive("code")}
            onClick={() => editor.chain().focus().toggleCode().run()}
            label="Inline code"
            icon={Code}
          />
          <ToolbarToggle
            pressed={editor.isActive("highlight")}
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            label="Highlight"
            icon={Highlighter}
          />
          <Separator orientation="vertical" className="mx-0.5 h-5" />
          {editor.isActive("link") ? (
            <ToolbarToggle
              pressed
              onClick={() => editor.chain().focus().unsetLink().run()}
              label="Remove link"
              icon={Link2Off}
            />
          ) : (
            <ToolbarToggle
              pressed={false}
              onClick={() => {
                setLinkValue("");
                setLinkEditing(true);
              }}
              label="Add link"
              icon={Link2}
            />
          )}
        </>
      )}
    </BubbleMenu>
  );
}
