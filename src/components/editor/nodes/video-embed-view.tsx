"use client";

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Film } from "lucide-react";

import { toVideoEmbedUrl } from "@/lib/editor/video";

export function VideoEmbedView({ node, selected }: NodeViewProps) {
  const embedUrl = node.attrs.src ? toVideoEmbedUrl(node.attrs.src) : null;

  return (
    <NodeViewWrapper
      data-video-embed
      className={`my-4 overflow-hidden rounded-xl border ${selected ? "border-primary ring-2 ring-primary/40" : "border-border"}`}
    >
      {embedUrl ? (
        <div className="relative aspect-video w-full">
          <iframe
            src={embedUrl}
            className="absolute inset-0 size-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title="Embedded video"
          />
        </div>
      ) : (
        <div className="flex aspect-video w-full items-center justify-center gap-2 bg-ws-surface-2 text-sm text-muted-foreground">
          <Film className="size-4" aria-hidden />
          Enter a YouTube or Vimeo URL
        </div>
      )}
    </NodeViewWrapper>
  );
}
