"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getMyWallet, type WalletBalance } from "@/lib/actions/wallet";
import { walletBalanceFromProfile } from "@/lib/wallet/map-profile-wallet";

export const WALLET_REFRESH_EVENT = "wallet:refresh";

function profileRowToWallet(row: Record<string, unknown>): WalletBalance {
  return walletBalanceFromProfile({
    wallet_balance: Number(row.wallet_balance ?? 0),
    bonus_wallet: Number(row.bonus_wallet ?? 0),
    cashout_wallet: Number(row.cashout_wallet ?? 0),
    bonus_redeem_wallet: Number(row.bonus_redeem_wallet ?? 0),
  });
}

/** Keeps wallet balances live via Supabase Realtime (requires supabase/profiles-realtime.sql). */
export function useLiveWallet(initial?: WalletBalance | null) {
  const [wallet, setWallet] = useState<WalletBalance | null>(initial ?? null);
  const [hidden, setHidden] = useState(false);

  const refresh = useCallback(async () => {
    const result = await getMyWallet();
    if ("error" in result) {
      setHidden(true);
      return;
    }
    setWallet(result);
    setHidden(false);
  }, []);

  useEffect(() => {
    if (!initial) void refresh();
  }, [initial, refresh]);

  useEffect(() => {
    const onRefresh = () => void refresh();
    window.addEventListener(WALLET_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(WALLET_REFRESH_EVENT, onRefresh);
  }, [refresh]);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;

    let cancelled = false;
    let channelInstance: ReturnType<typeof supabase.channel> | null = null;

    void supabase.auth.getUser().then(({ data: { user } }) => {
      const uid = user?.id;
      if (!uid || cancelled) return;

      const channelName = `wallet-live-${uid}-${Date.now()}`;

      // Build channel with all .on() handlers BEFORE calling .subscribe()
      channelInstance = supabase.channel(channelName);

      channelInstance
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${uid}` },
          (payload) => {
            setWallet(profileRowToWallet(payload.new as Record<string, unknown>));
            setHidden(false);
            window.dispatchEvent(new Event(WALLET_REFRESH_EVENT));
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "game_load_requests",
            filter: `user_id=eq.${uid}`,
          },
          (payload) => {
            const row = payload.new as Record<string, unknown>;
            const status = String(row.status ?? "");
            const loadType = String(row.load_type ?? "");
            if (
              (status === "completed" || status === "failed" || status === "cancelled") &&
              (loadType === "load" || loadType === "reload" || loadType === "redeem")
            ) {
              void refresh();
            }
          }
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channelInstance) {
        supabase.removeChannel(channelInstance);
      }
    };
  }, [refresh]);

  return { wallet, hidden, refresh };
}
