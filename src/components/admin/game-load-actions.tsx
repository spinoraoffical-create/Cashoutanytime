"use client";

import { useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAdminPanelUrlForGame } from "@/lib/actions/game-loads";
import {
  adminFinancialStatusDecision,
  displayedLoadError,
  PROVIDER_OUTCOME_UNVERIFIED,
} from "@/lib/game-automation/load-outcome";
import { toast } from "sonner";
import type { GameLoadRequest } from "@/lib/game-automation/types";

interface GameLoadActionsProps {
  load: GameLoadRequest & {
    user?: { full_name?: string | null; email?: string } | null;
  };
}

export function GameLoadActions({ load }: GameLoadActionsProps) {
  const [busy, setBusy] = useState(false);
  const decision = adminFinancialStatusDecision({
    status: load.status,
    loadType: load.load_type,
  });
  const loadError = displayedLoadError(load.error_message, load.wallet_refunded);

  async function openPanel() {
    setBusy(true);
    const result = await getAdminPanelUrlForGame(load.game_slug);
    setBusy(false);
    if (result.error || !result.url) {
      toast.error(result.error ?? "Panel URL not configured");
      return;
    }
    window.open(result.url, "_blank", "noopener,noreferrer");
  }

  if (decision.reason === "already_settled") {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 min-w-[180px]">
      <Button size="sm" variant="outline" onClick={openPanel} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
        Open {load.game_name} panel
      </Button>
      <p className="text-xs leading-5 text-[#9fb0d0]">{PROVIDER_OUTCOME_UNVERIFIED}</p>
      {load.game_username && (
        <p className="text-xs text-[#6b6d8f]">User: {load.game_username}</p>
      )}
      {load.game_password && (
        <p className="text-xs font-mono text-[#00E5FF] break-all">Pass: {load.game_password}</p>
      )}
      {load.admin_notes && (
        <p className="text-xs text-amber-200">{load.admin_notes}</p>
      )}
      {loadError ? <p className="text-xs text-destructive">{loadError}</p> : null}
    </div>
  );
}
