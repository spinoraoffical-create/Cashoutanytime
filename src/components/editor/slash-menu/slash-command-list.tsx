"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import type { SuggestionKeyDownProps, SuggestionProps } from "@tiptap/suggestion";

import { cn } from "@/lib/utils";
import type { SlashItem } from "./slash-items";

export interface SlashCommandListRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

export const SlashCommandList = forwardRef<SlashCommandListRef, SuggestionProps<SlashItem>>(
  (props, ref) => {
    const [selected, setSelected] = useState(0);

    useEffect(() => setSelected(0), [props.items]);

    useImperativeHandle(
      ref,
      () => ({
        onKeyDown: ({ event }) => {
          if (event.key === "ArrowDown") {
            setSelected((i) => (props.items.length ? (i + 1) % props.items.length : 0));
            return true;
          }
          if (event.key === "ArrowUp") {
            setSelected((i) =>
              props.items.length ? (i - 1 + props.items.length) % props.items.length : 0
            );
            return true;
          }
          if (event.key === "Enter") {
            const item = props.items[selected];
            if (item) props.command(item);
            return true;
          }
          return false;
        },
      }),
      [props, selected]
    );

    if (props.items.length === 0) {
      return (
        <div className="w-64 rounded-lg border border-border bg-popover p-3 text-sm text-muted-foreground shadow-lg">
          No matching blocks
        </div>
      );
    }

    return (
      <div className="max-h-80 w-72 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-lg">
        {props.items.map((item, i) => (
          <button
            key={item.title}
            type="button"
            onMouseEnter={() => setSelected(i)}
            onClick={() => props.command(item)}
            className={cn(
              "flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
              i === selected ? "bg-accent text-accent-foreground" : "hover:bg-accent/60"
            )}
          >
            <item.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block font-medium leading-tight">{item.title}</span>
              <span className="block truncate text-xs text-muted-foreground">{item.description}</span>
            </span>
          </button>
        ))}
      </div>
    );
  }
);
SlashCommandList.displayName = "SlashCommandList";
