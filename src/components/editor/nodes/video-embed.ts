import { Node, createAtomBlockMarkdownSpec } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";

import { VideoEmbedView } from "./video-embed-view";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    videoEmbed: {
      setVideoEmbed: (attrs: { src: string }) => ReturnType;
    };
  }
}

/** Atomic node embedding a YouTube/Vimeo URL as a responsive iframe. */
export const VideoEmbed = Node.create({
  name: "videoEmbed",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-video-embed]" }];
  },

  renderHTML({ node }) {
    return ["div", { "data-video-embed": "", "data-src": node.attrs.src }];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VideoEmbedView);
  },

  addCommands() {
    return {
      setVideoEmbed:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },

  ...createAtomBlockMarkdownSpec({
    nodeName: "videoEmbed",
    requiredAttributes: ["src"],
    allowedAttributes: ["src"],
  }),
});
