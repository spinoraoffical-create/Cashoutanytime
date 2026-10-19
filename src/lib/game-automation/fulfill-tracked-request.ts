import "server-only";

export type TrackedFulfillmentResult =
  | { success: true }
  | { success: false; error: string };

type Runner = (requestId: string) => Promise<TrackedFulfillmentResult>;

let runner: Runner | null = null;

/** Registered by the game-load module. This file is not a public server action. */
export function registerTrackedFulfillment(next: Runner) {
  runner = next;
}

export async function fulfillTrackedRequest(requestId: string): Promise<TrackedFulfillmentResult> {
  if (!runner) {
    await import("@/lib/actions/game-loads");
  }
  if (!runner) {
    return { success: false, error: "Game load is not available." };
  }
  return runner(requestId);
}
