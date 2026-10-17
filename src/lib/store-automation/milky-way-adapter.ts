import { createLiveStoreAdapter } from "./adapters";

/** Milky Way store adapter. execute() does not open the agent portal. */
export function createMilkyWayStoreAdapter() {
  return createLiveStoreAdapter("milky-way");
}
