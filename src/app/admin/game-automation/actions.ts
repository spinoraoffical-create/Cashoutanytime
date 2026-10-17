"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { SupabaseTransferStore } from "@/lib/game-automation/supabase-transfer-store";
import type { TransferProvider } from "@/lib/game-automation/transfer-ledger";
import { requireSuperAdmin } from "@/lib/data/admin";

const PROVIDERS = new Set<TransferProvider>(["fire-kirin", "milky-way", "orion-stars"]);

function notice(code: string): never {
  redirect(`/admin/game-automation?notice=${code}`);
}

export async function setProviderPause(formData: FormData) {
  await requireSuperAdmin();
  const provider = String(formData.get("provider") || "");
  if (!PROVIDERS.has(provider as TransferProvider)) notice("invalid");
  const paused = String(formData.get("paused") || "") === "true";
  try {
    await new SupabaseTransferStore().setPaused(
      provider as TransferProvider,
      paused,
      paused
        ? "Paused from Game automation."
        : "Resumed from Game automation. A resumed provider still needs a supervised transfer test."
    );
  } catch {
    notice("ledger-missing");
  }
  revalidatePath("/admin/game-automation");
  notice(paused ? "paused" : "resumed");
}

export async function reconcileTransfer(formData: FormData) {
  await requireSuperAdmin();
  const operationKey = String(formData.get("operationKey") || "");
  const decision = String(formData.get("decision") || "") === "confirmed" ? "confirmed" : "failed";
  const note = String(formData.get("note") || "").replace(/\s+/g, " ").slice(0, 500);
  if (!/^[A-Za-z0-9:._-]{8,120}$/.test(operationKey)) notice("invalid");
  try {
    const saved = await new SupabaseTransferStore().reconcile(operationKey, decision, note || "Reviewed by staff.");
    if (!saved) notice("unchanged");
  } catch {
    notice("reconcile-failed");
  }
  revalidatePath("/admin/game-automation");
  notice("reconciled");
}
