import { Markdown } from "@tiptap/markdown";
import type { Editor } from "@tiptap/core";

/**
 * Isolates the @tiptap/markdown API surface behind two functions so a future
 * swap (e.g. to the community `tiptap-markdown` package) touches one file.
 */
export function markdownExtension() {
  return Markdown.configure({
    indentation: { style: "space", size: 2 },
  });
}

export function docToMarkdown(editor: Editor): string {
  return editor.getMarkdown();
}

export function loadMarkdown(editor: Editor, markdown: string) {
  editor.commands.setContent(markdown, { contentType: "markdown" });
}
