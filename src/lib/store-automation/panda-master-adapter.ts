import { createLiveStoreAdapter } from "./adapters";

/** Panda Master store adapter. No provider client is called because none exists. */
export function createPandaMasterStoreAdapter() {
  return createLiveStoreAdapter("panda-master");
}
