import { createLiveStoreAdapter } from "./adapters";

/** Orion Stars store adapter. execute() does not open Agent.aspx. */
export function createOrionStarsStoreAdapter() {
  return createLiveStoreAdapter("orion-stars");
}
