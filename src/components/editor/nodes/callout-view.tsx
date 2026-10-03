"use client";

import { NodeViewWrapper, NodeViewContent, type NodeViewProps } from "@tiptap/react";
import { Info, CheckCircle2, TriangleAlert, OctagonAlert } from "lucide-react";

import { cn } from "@/lib/utils";
import { CALLOUT_VARIANTS, type CalloutVariant } from "./callout";

const VARIANT_STYLE: Record<CalloutVariant, { icon: typeof Info; className: string }> = {
  info: { icon: Info, className: "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-300" },
  success: {
    icon: CheckCircle2,
    className: "border-ws-green/30 bg-ws-green/10 text-ws-green-deep dark:text-ws-green",
  },
  warning: {
    icon: TriangleAlert,
    className: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300",
  },
  danger: {
    icon: OctagonAlert,
    className: "border-destructive/30 bg-destructive/10 text-destructive",
  },
};

export function CalloutView({ node, updateAttributes, editor }: NodeViewProps) {
  const variant = (node.attrs.type as CalloutVariant) ?? "info";
  const { icon: Icon, className } = VARIANT_STYLE[variant];

  return (
    <NodeViewWrapper data-callout className={cn("my-4 rounded-lg border px-4 py-3", className)}>
      <div className="flex items-start gap-3">
        <span contentEditable={false} className="mt-0.5 shrink-0">
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 text-sm text-foreground [&_p]:m-0">
          <NodeViewContent />
        </div>
        {editor.isEditable && (
          <select
            value={variant}
            onChange={(e) => updateAttributes({ type: e.target.value as CalloutVariant })}
            className="shrink-0 rounded-md border border-border bg-card px-1.5 py-0.5 text-xs capitalize"
            aria-label="Callout type"
            contentEditable={false}
          >
            {CALLOUT_VARIANTS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        )}
      </div>
    </NodeViewWrapper>
  );
}
