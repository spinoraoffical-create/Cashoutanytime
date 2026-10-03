import { Node, mergeAttributes, createBlockMarkdownSpec } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";

import { CalloutView } from "./callout-view";

export type CalloutVariant = "info" | "success" | "warning" | "danger";

export const CALLOUT_VARIANTS: CalloutVariant[] = ["info", "success", "warning", "danger"];

export interface CalloutOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (attrs?: { type: CalloutVariant }) => ReturnType;
    };
  }
}

/**
 * Single Callout node with a `type` variant attribute rather than four
 * separate node types for info/success/warning/danger — keeps the schema,
 * slash menu, and markdown spec to one definition.
 */
export const Callout = Node.create<CalloutOptions>({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,
  isolating: true,

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      type: {
        default: "info" as CalloutVariant,
        parseHTML: (el) => el.getAttribute("data-callout-type") ?? "info",
        renderHTML: (attrs) => ({ "data-callout-type": attrs.type }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-callout]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { "data-callout": "" }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutView);
  },

  addCommands() {
    return {
      setCallout:
        (attrs) =>
        ({ commands }) =>
          commands.wrapIn(this.name, attrs),
    };
  },

  ...createBlockMarkdownSpec({
    nodeName: "callout",
    defaultAttributes: { type: "info" },
    allowedAttributes: ["type"],
  }),
});
