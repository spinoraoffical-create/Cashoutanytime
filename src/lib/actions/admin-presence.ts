"use server";

import { pingSitePresence } from "@/lib/actions/presence";

/** @deprecated Use pingSitePresence — kept for existing admin heartbeat imports. */
export async function pingAdminPresence(): Promise<void> {
  await pingSitePresence();
}
