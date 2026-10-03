import { Extension } from "@tiptap/core";

export interface RceStorage {
  onUploadImage?: (file: File) => Promise<string>;
}

declare module "@tiptap/core" {
  interface Storage {
    rce: RceStorage;
  }
}

/** Mutable slot for callbacks (image upload) that node views and slash commands need at command-run time. */
export const RceStorageExtension = Extension.create<Record<string, never>, RceStorage>({
  name: "rce",
  addStorage() {
    return { onUploadImage: undefined };
  },
});
