import StarterKit from "@tiptap/starter-kit";
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import { Highlight } from "@tiptap/extension-highlight";
import { Image } from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extension-placeholder";
import { CharacterCount } from "@tiptap/extension-character-count";
import { TaskList, TaskItem } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import { createLowlight, common } from "lowlight";
import type { AnyExtension } from "@tiptap/core";

import { markdownExtension } from "@/lib/editor/markdown";
import { Callout } from "./nodes/callout";
import { VideoEmbed } from "./nodes/video-embed";
import { createSlashCommandExtension } from "./slash-menu/slash-command-extension";

const lowlight = createLowlight(common);

export function getEditorExtensions(opts: { placeholder?: string } = {}): AnyExtension[] {
  return [
    StarterKit.configure({
      codeBlock: false,
      link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
    }),
    CodeBlockLowlight.configure({ lowlight }),
    Highlight.configure({ multicolor: false }),
    Image.configure({
      inline: false,
      allowBase64: false,
      resize: { enabled: true, minWidth: 120, minHeight: 80 },
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    TableKit.configure({ table: { resizable: true } }),
    Placeholder.configure({ placeholder: opts.placeholder ?? "Start writing…" }),
    CharacterCount,
    Callout,
    VideoEmbed,
    markdownExtension(),
    createSlashCommandExtension(),
  ];
}
