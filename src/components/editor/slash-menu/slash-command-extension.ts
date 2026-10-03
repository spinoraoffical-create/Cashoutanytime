import { Extension } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";

import { filterSlashItems, type SlashItem } from "./slash-items";
import { SlashCommandList, type SlashCommandListRef } from "./slash-command-list";

export function createSlashCommandExtension() {
  return Extension.create({
    name: "slashCommand",

    addProseMirrorPlugins() {
      return [
        Suggestion<SlashItem>({
          editor: this.editor,
          char: "/",
          startOfLine: false,
          items: ({ query }) => filterSlashItems(query),
          command: ({ editor, range, props }) => props.command({ editor, range }),
          render: () => {
            let component: ReactRenderer<SlashCommandListRef> | null = null;
            let unmount: (() => void) | null = null;

            return {
              onStart: (props) => {
                component = new ReactRenderer<SlashCommandListRef, typeof props>(SlashCommandList, {
                  props,
                  editor: props.editor,
                });
                unmount = props.mount(component.element as HTMLElement);
              },
              onUpdate: (props) => {
                component?.updateProps(props);
              },
              onKeyDown: (props) => {
                if (props.event.key === "Escape") {
                  unmount?.();
                  return true;
                }
                return component?.ref?.onKeyDown(props) ?? false;
              },
              onExit: () => {
                unmount?.();
                component?.destroy();
              },
            };
          },
        }),
      ];
    },
  });
}
