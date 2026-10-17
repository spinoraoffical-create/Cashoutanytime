import { capabilityFor } from "./capabilities";
import type { StoreAdapter, StoreAdapterResponse, StoreCapability, StoreCommand, StoreSlug } from "./types";

export const LIVE_STORE_BLOCKED =
  "Live store portal was not contacted. Browser automation is not authorized.";

export function createLiveStoreAdapter(slug: StoreSlug): StoreAdapter {
  return {
    slug,
    capability: () => capabilityFor(slug),
    async execute(): Promise<StoreAdapterResponse> {
      return { outcome: "confirmed_failure", message: LIVE_STORE_BLOCKED };
    },
  };
}

export interface MockStoreOptions {
  capability?: Partial<StoreCapability>;
  execute: (command: StoreCommand) => Promise<StoreAdapterResponse>;
}

/** Test double. It has no network access. */
export function createMockStoreAdapter(slug: StoreSlug, options: MockStoreOptions): StoreAdapter & { calls: StoreCommand[] } {
  const calls: StoreCommand[] = [];
  const base = capabilityFor(slug);
  return {
    slug,
    calls,
    capability: () => ({
      ...base,
      ...options.capability,
      functions: { ...base.functions, ...options.capability?.functions },
      evidence: options.capability?.evidence ?? base.evidence,
    }),
    async execute(command: StoreCommand) {
      calls.push(command);
      return options.execute(command);
    },
  };
}
