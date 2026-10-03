"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Copy,
  Eye,
  EyeOff,
  Loader2,
  UserPlus,
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  Zap,
  RefreshCw,
  Pencil,
  X,
  ShieldCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  requestGameLoad,
  requestGameRedeem,
  requestGameAccountCreate,
  requestGameCheckBalance,
  getMyGameLoads,
  getMyGameAccount,
  getDepositRolloverForGame,
  healStaleGameLoads,
  cancelMyGameLoad,
} from "@/lib/actions/game-loads";
import type { Game } from "@/lib/games";
import { GAME_BONUS_RULES } from "@/lib/games";
import type { GameLoadRequest } from "@/lib/game-automation/types";
import { isAutomatedGameSlug } from "@/lib/game-automation/types";
import { isGameAccountCreateLoadType } from "@/lib/game-automation/account-create";
import { WALLET_LOAD_LIMITS } from "@/lib/game-automation/config";
import {
  maxUsernameLenForGame,
  validateCustomGameAccountCredentials,
} from "@/lib/game-automation/account-username";
import { previewJuwaUsername } from "@/lib/game-automation/juwa-credentials";
import { cn, formatRelativeTime } from "@/lib/utils";
import { toast } from "sonner";
import type { DepositRolloverBounds } from "@/lib/wallet/deposit-redeem-rollover";
import { WALLET_REFRESH_EVENT } from "@/lib/wallet/use-live-wallet";

interface GameWalletLoadSectionProps {
  game: Game;
  initialAccount?: {
    game_username: string;
    game_password: string | null;
  } | null;
  onAccountChange?: (hasAccount: boolean) => void;
}

export function GameWalletLoadSection({
  game,
  initialAccount,
  onAccountChange,
}: GameWalletLoadSectionProps) {
  const supabase = useMemo(() => createClient(), []);

  const [walletBalance, setWalletBalance] = useState(0);
  const [cashoutWallet, setCashoutWallet] = useState(0);
  const [kycStatus, setKycStatus] = useState<string>("unverified");
  const [amount, setAmount] = useState(String(WALLET_LOAD_LIMITS.min));
  const [redeemAmount, setRedeemAmount] = useState(String(WALLET_LOAD_LIMITS.min));
  const [redeemAll, setRedeemAll] = useState(false);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [checkingBalance, setCheckingBalance] = useState(false);
  const [fundsTab, setFundsTab] = useState<"load" | "redeem">("load");
  const [customMode, setCustomMode] = useState(false);
  const [customUsername, setCustomUsername] = useState("");
  const [customPassword, setCustomPassword] = useState("");
  const [recentLoads, setRecentLoads] = useState<GameLoadRequest[]>([]);
  const [lastVerifiedBalance, setLastVerifiedBalance] = useState<number | null>(null);
  const [requesterName, setRequesterName] = useState<string | null>(null);
  const [requesterEmail, setRequesterEmail] = useState<string | null>(null);
  const [savedAccount, setSavedAccount] = useState<{
    game_username: string;
    game_password: string | null;
  } | null>(
    initialAccount?.game_username
      ? {
          game_username: initialAccount.game_username,
          game_password: initialAccount.game_password,
        }
      : null
  );
  const [showPassword, setShowPassword] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [depositRollover, setDepositRollover] = useState<DepositRolloverBounds | null>(null);
  const failedToastRef = useRef<string | null>(null);
  const pendingJobIdsRef = useRef<Set<string>>(new Set());
  const failedToastShownRef = useRef<Set<string>>(new Set());
  const seededHistoricalFailuresRef = useRef(false);
  const pendingLoadIdsRef = useRef<Set<string>>(new Set());
  const accountReadyRef = useRef(Boolean(initialAccount?.game_username));

  const refreshWallet = useCallback(async () => {
    if (!supabase) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("profiles")
      .select("wallet_balance, cashout_wallet, kyc_status, full_name, email")
      .eq("id", user.id)
      .single();

    if (data) {
      setWalletBalance(Number(data.wallet_balance ?? 0));
      setCashoutWallet(Number(data.cashout_wallet ?? 0));
      setKycStatus(String(data.kyc_status ?? "unverified"));
      setRequesterName(data.full_name ?? null);
      setRequesterEmail(data.email ?? null);
    }
  }, [supabase]);

  const refreshAccount = useCallback(async () => {
    const account = await getMyGameAccount(game.slug);
    if (account?.game_username) {
      setSavedAccount({
        game_username: account.game_username,
        game_password: account.game_password,
      });
    }
  }, [game.slug]);

  const refreshLoads = useCallback(async () => {
    const loads = (await getMyGameLoads(game.slug)) as GameLoadRequest[];
    setRecentLoads(loads);

    // Fetch last completed balance check to prevent pagination truncation bug
    if (supabase) {
      const { data: lastCheck } = await supabase
        .from("game_load_requests")
        .select("amount")
        .eq("game_slug", game.slug)
        .eq("load_type", "check_balance")
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastCheck) {
        setLastVerifiedBalance(Number(lastCheck.amount));
      } else {
        setLastVerifiedBalance(null);
      }
    }

    const pendingLoads = loads.filter(
      (l) =>
        (l.load_type === "load" || l.load_type === "reload") &&
        (l.status === "pending" || l.status === "processing")
    );
    const pendingIds = new Set(pendingLoads.map((l) => l.id));
    const hadPending = pendingLoadIdsRef.current.size > 0;
    const finishedLoad = loads.some(
      (l) =>
        (l.load_type === "load" || l.load_type === "reload") &&
        (l.status === "completed" || l.status === "failed" || l.status === "cancelled") &&
        pendingLoadIdsRef.current.has(l.id)
    );
    const finishedRedeem = loads.some(
      (l) =>
        l.load_type === "redeem" &&
        (l.status === "completed" || l.status === "failed" || l.status === "cancelled") &&
        pendingJobIdsRef.current.has(l.id)
    );
    pendingLoadIdsRef.current = pendingIds;

    if (finishedLoad || finishedRedeem || (hadPending && pendingIds.size === 0)) {
      void refreshWallet();
    }

    if (!seededHistoricalFailuresRef.current) {
      for (const load of loads) {
        if (load.status === "failed") failedToastShownRef.current.add(load.id);
      }
      seededHistoricalFailuresRef.current = true;
    }

    for (const load of loads) {
      if (load.status === "pending" || load.status === "processing") {
        pendingJobIdsRef.current.add(load.id);
      }
    }

    const justFailed = loads.find(
      (load) =>
        load.status === "failed" &&
        pendingJobIdsRef.current.has(load.id) &&
        !failedToastShownRef.current.has(load.id)
    );
    if (justFailed) {
      failedToastShownRef.current.add(justFailed.id);
      pendingJobIdsRef.current.delete(justFailed.id);
      failedToastRef.current = justFailed.id;
      toast.error(justFailed.error_message ?? "Request failed");
      void refreshWallet();
    }

    const justCompleted = loads.find(
      (load) =>
        load.status === "completed" &&
        pendingJobIdsRef.current.has(load.id)
    );
    if (justCompleted) {
      pendingJobIdsRef.current.delete(justCompleted.id);
      if (justCompleted.load_type === "check_balance") {
        toast.success(`Balance: $${Number(justCompleted.amount).toFixed(2)}`);
      } else if (justCompleted.load_type === "load" || justCompleted.load_type === "reload") {
        toast.success(`$${Number(justCompleted.amount).toFixed(2)} loaded to ${game.name}`);
      } else if (justCompleted.load_type === "redeem") {
        toast.success(
          `$${Number(justCompleted.amount).toFixed(2)} redeemed to your Deposit Redeem wallet`
        );
        void refreshWallet();
      } else if (isGameAccountCreateLoadType(justCompleted.load_type) && justCompleted.game_username) {
        toast.success(`${game.name} account ready: ${justCompleted.game_username}`);
        void refreshAccount();
      }
    }

    for (const load of loads) {
      if (load.status === "cancelled") {
        pendingJobIdsRef.current.delete(load.id);
      }
    }

    const completedCreate = loads.find(
      (l) =>
        l.status === "completed" &&
        isGameAccountCreateLoadType(l.load_type) &&
        l.game_username
    );
    if (completedCreate?.game_username) {
      setSavedAccount({
        game_username: completedCreate.game_username,
        game_password: completedCreate.game_password,
      });
    } else {
      void refreshAccount();
    }

    return loads;
  }, [game.slug, refreshWallet, refreshAccount, supabase]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      void refreshWallet();
      await refreshAccount();
      await healStaleGameLoads(game.slug, 20);
      await refreshLoads();
      if (cancelled) return;
      accountReadyRef.current = true;
      const account = await getMyGameAccount(game.slug);
      if (cancelled) return;
      onAccountChange?.(Boolean(account?.game_username));
    }

    void init();

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshLoads();
        void refreshWallet();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refreshWallet, refreshAccount, refreshLoads, game.slug, onAccountChange]);

  useEffect(() => {
    if (!accountReadyRef.current) return;
    onAccountChange?.(Boolean(savedAccount?.game_username));
  }, [savedAccount, onAccountChange]);

  useEffect(() => {
    const onWalletRefresh = () => void refreshWallet();
    window.addEventListener(WALLET_REFRESH_EVENT, onWalletRefresh);
    return () => window.removeEventListener(WALLET_REFRESH_EVENT, onWalletRefresh);
  }, [refreshWallet]);

  useEffect(() => {
    if (!supabase) return;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || cancelled) return;
      channel = supabase
        .channel(`game-wallet-profile-${user.id}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
          (payload) => {
            const row = payload.new as Record<string, unknown>;
            setWalletBalance(Number(row.wallet_balance ?? 0));
            setCashoutWallet(Number(row.cashout_wallet ?? 0));
            setKycStatus(String(row.kyc_status ?? "unverified"));
          }
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [supabase]);

  useEffect(() => {
    if (!supabase) return;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || cancelled) return;
      channel = supabase
        .channel(`game-load-requests-${user.id}-${game.slug}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "game_load_requests", filter: `user_id=eq.${user.id}` },
          () => {
            void refreshAccount();
            void refreshLoads();
            void refreshWallet();
          }
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [supabase, game.slug, refreshAccount, refreshLoads, refreshWallet]);

  useEffect(() => {
    if (fundsTab === "redeem") void refreshWallet();
  }, [fundsTab, refreshWallet]);

  const pendingCreate = recentLoads.some(
    (l) =>
      isGameAccountCreateLoadType(l.load_type) &&
      (l.status === "pending" || l.status === "processing")
  );
  const pendingLoad = recentLoads.some(
    (l) =>
      (l.load_type === "load" || l.load_type === "reload") &&
      (l.status === "pending" || l.status === "processing")
  );
  const pendingRedeem = recentLoads.some(
    (l) => l.load_type === "redeem" && (l.status === "pending" || l.status === "processing")
  );
  const pendingCheck = recentLoads.some(
    (l) => l.load_type === "check_balance" && (l.status === "pending" || l.status === "processing")
  );
  const anyPending = pendingCreate || pendingLoad || pendingRedeem || pendingCheck;

  useEffect(() => {
    if (!anyPending) return;

    void healStaleGameLoads(game.slug, 20).then((result) => {
      if (result.healed > 0) void refreshLoads();
    });

    void refreshLoads();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        void healStaleGameLoads(game.slug, 20).then((result) => {
          if (result.healed > 0) void refreshLoads();
        });
        void refreshLoads();
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [anyPending, refreshLoads, game.slug]);

  useEffect(() => {
    if (walletBalance > 0) {
      const suggested = Math.min(walletBalance, WALLET_LOAD_LIMITS.max);
      setAmount(String(Math.round(suggested * 100) / 100));
    }
  }, [walletBalance]);

  useEffect(() => {
    void getDepositRolloverForGame(game.slug).then((stats) => setDepositRollover(stats));
  }, [game.slug, recentLoads]);

  const available = walletBalance;
  const parsedAmount = parseFloat(amount) || 0;
  const previewStem = previewJuwaUsername(requesterName, requesterEmail);
  const usesNumberedAccounts =
    game.slug === "game-vault" || game.slug === "cash-frenzy" || game.slug === "vegas-sweeps";
  const previewAccount = usesNumberedAccounts
    ? (() => {
        if (savedAccount?.game_username) {
          const match = savedAccount.game_username.match(/^(.+?)(\d+)$/i);
          if (match) return `${match[1]}${parseInt(match[2], 10) + 1}`;
          return `${savedAccount.game_username}2`;
        }
        return `${previewStem}1`;
      })()
    : previewStem;

  const lastKnownBalance = lastVerifiedBalance;
  const parsedRedeemAmount = parseFloat(redeemAmount) || 0;

  const activeRedeemRollover = depositRollover;

  const redeemMinMult = GAME_BONUS_RULES.redeemMin;
  const redeemMaxMult = GAME_BONUS_RULES.redeemMax;
  const loadLabel = "deposit";

  const redeemRulesActive =
    activeRedeemRollover !== null && activeRedeemRollover.activeDepositAmount > 0;
  const canRedeem = redeemRulesActive;
  const kycVerified = kycStatus === "verified";

  const redeemMaxAllowed = redeemRulesActive
    ? Math.min(WALLET_LOAD_LIMITS.max, activeRedeemRollover!.maxRedeemRemaining)
    : WALLET_LOAD_LIMITS.max;

  const redeemBlocked =
    redeemRulesActive &&
    lastKnownBalance !== null &&
    lastKnownBalance < activeRedeemRollover!.minGameBalance;

  async function copyText(text: string, label: string) {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  }

  const hasSavedAccount = Boolean(savedAccount?.game_username);

  const activeCreateLoad = recentLoads.find(
    (l) =>
      isGameAccountCreateLoadType(l.load_type) &&
      (l.status === "pending" || l.status === "processing")
  );
  const createLoadStuck = activeCreateLoad
    ? Date.now() - new Date(activeCreateLoad.updated_at ?? activeCreateLoad.created_at).getTime() >
      10 * 60 * 1000
    : false;

  function pendingCreateButtonLabel(): string {
    if (!pendingCreate) {
      return hasSavedAccount ? "Replace Account" : "Create Account";
    }
    if (activeCreateLoad?.admin_notes === "account_replace") return "Replacing account…";
    if (hasSavedAccount) return "Previous request running…";
    return "Creating account…";
  }

  async function handleCancelLoad(loadId: string) {
    setCancellingId(loadId);
    const result = await cancelMyGameLoad(loadId, game.slug);
    if (result.error) toast.error(result.error);
    else toast.success("Cancelled — click Replace Account again.");
    void refreshLoads();
    setCancellingId(null);
  }

  async function handleCreateAccount(custom?: { username: string; password: string }) {
    if (hasSavedAccount) {
      const ok = window.confirm(
        `Replace your ${game.name} login?\n\nA new username and password will be created. Your current login (${savedAccount!.game_username}) will no longer be shown here.`
      );
      if (!ok) return;
    }

    setCreating(true);
    const result = await requestGameAccountCreate({
      gameSlug: game.slug,
      gameName: game.name,
      username: custom?.username,
      password: custom?.password,
      replaceAccount: hasSavedAccount,
    });
    if (result.error) {
      toast.error(result.error);
    } else {
      if (result.requestId) pendingJobIdsRef.current.add(result.requestId);
      toast.success(
        hasSavedAccount
          ? `Replacing your ${game.name} account…`
          : `Creating your ${game.name} account…`
      );
      setCustomMode(false);
      setCustomUsername("");
      setCustomPassword("");
    }
    void refreshLoads();
    setCreating(false);
  }

  async function handleCreateCustom() {
    const validated = validateCustomGameAccountCredentials(
      customUsername,
      customPassword,
      game.slug
    );
    if (!validated.ok) {
      toast.error(validated.error);
      return;
    }
    await handleCreateAccount({
      username: validated.username,
      password: validated.password,
    });
  }

  async function handleCheckBalance() {
    if (!savedAccount?.game_username) {
      toast.error("Create your account first");
      return;
    }
    setCheckingBalance(true);
    const result = await requestGameCheckBalance({
      gameSlug: game.slug,
      gameName: game.name,
      gameUsername: savedAccount.game_username,
    });
    if (result.error) toast.error(result.error);
    else {
      if (result.requestId) pendingJobIdsRef.current.add(result.requestId);
      toast.success("Checking your live game balance…");
    }
    void refreshLoads();
    setCheckingBalance(false);
  }

  async function handleLoad() {
    if (!savedAccount?.game_username) {
      toast.error("Create your account first");
      return;
    }
    if (parsedAmount < WALLET_LOAD_LIMITS.min || parsedAmount > WALLET_LOAD_LIMITS.max) {
      toast.error(`Enter $${WALLET_LOAD_LIMITS.min}–$${WALLET_LOAD_LIMITS.max}`);
      return;
    }
    if (parsedAmount > available) {
      toast.error("Not enough balance in selected wallet");
      return;
    }

    setLoading(true);
    const result = await requestGameLoad({
      gameSlug: game.slug,
      gameName: game.name,
      amount: parsedAmount,
      walletType: "current",
      gameUsername: savedAccount.game_username,
    });

    if (result.error) toast.error(result.error);
    else {
      if (result.requestId) pendingJobIdsRef.current.add(result.requestId);
      toast.success(`Load queued! $${parsedAmount.toFixed(2)} — bot will credit ${game.name} shortly.`);
      void refreshWallet();
      void refreshLoads();
    }
    setLoading(false);
  }

  async function handleRedeem() {
    if (!savedAccount?.game_username) {
      toast.error("Create your account first");
      return;
    }

    if (!canRedeem) {
      toast.error("Load credits from Total Deposit into this game before redeeming.");
      return;
    }

    if (redeemRulesActive && activeRedeemRollover) {
      if (activeRedeemRollover.maxRedeemRemaining <= 0) {
        toast.error(`You have reached the ${redeemMaxMult}x redeem limit for your ${loadLabel}.`);
        return;
      }
      if (lastKnownBalance === null && !pendingCheck) {
        toast.error(
          `Check your live game balance first — you need at least $${activeRedeemRollover.minGameBalance.toFixed(2)} in game (${redeemMinMult}x your $${activeRedeemRollover.activeDepositAmount.toFixed(2)} ${loadLabel}) to redeem.`
        );
        return;
      }
      if (redeemBlocked) {
        toast.error(
          `Need at least $${activeRedeemRollover.minGameBalance.toFixed(2)} in game (${redeemMinMult}x your $${activeRedeemRollover.activeDepositAmount.toFixed(2)} ${loadLabel}). Last checked: $${lastKnownBalance!.toFixed(2)}.`
        );
        return;
      }
    }

    if (!redeemAll) {
      const maxPartial = redeemRulesActive ? redeemMaxAllowed : WALLET_LOAD_LIMITS.max;
      if (parsedRedeemAmount < WALLET_LOAD_LIMITS.min || parsedRedeemAmount > maxPartial) {
        toast.error(`Enter $${WALLET_LOAD_LIMITS.min}–$${maxPartial.toFixed(2)}`);
        return;
      }
    }

    setRedeeming(true);
    const result = await requestGameRedeem({
      gameSlug: game.slug,
      gameName: game.name,
      amount: redeemAll ? undefined : parsedRedeemAmount,
      redeemAll,
      gameUsername: savedAccount.game_username,
      walletType: "current",
    });

    const destLabel = "Deposit Redeem";
    if (result.error) toast.error(result.error);
    else {
      if (result.requestId) pendingJobIdsRef.current.add(result.requestId);
      toast.success(
        redeemAll
          ? `Redeem queued — bot will cash out your full game balance to your ${destLabel} wallet.`
          : `Redeem queued! $${parsedRedeemAmount.toFixed(2)} will move to your ${destLabel} wallet.`
      );
      void refreshWallet();
      void refreshLoads();
    }
    setRedeeming(false);
  }

  function activityLabel(load: GameLoadRequest) {
    if (isGameAccountCreateLoadType(load.load_type)) {
      return load.admin_notes === "account_replace" ? "Replace account" : "Create account";
    }
    if (load.load_type === "check_balance") {
      return load.status === "completed"
        ? `Balance check · $${Number(load.amount).toFixed(2)}`
        : "Balance check";
    }
    if (load.load_type === "redeem") {
      if (load.redeem_all && load.status === "completed") {
        return `$${Number(load.amount).toFixed(2)} redeem (all)`;
      }
      if (load.redeem_all) return "Redeem all";
      return `$${Number(load.amount).toFixed(2)} redeem`;
    }
    return `$${Number(load.amount).toFixed(2)} load`;
  }

  return (
    <section className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-950/40 to-[#161616] p-5 space-y-5">
      <div className="flex items-center gap-2">
        <Zap className="h-5 w-5 text-emerald-400" />
        <h2 className="font-bold text-white">{game.name} Account</h2>
      </div>

      {/* Your Account — like Game Vault */}
      <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Your Account
        </p>

        {savedAccount ? (
          <>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Active
              </span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Username</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-white">{savedAccount.game_username}</span>
                  <button
                    type="button"
                    onClick={() => copyText(savedAccount.game_username, "Username")}
                    className="text-muted-foreground hover:text-white"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {savedAccount.game_password && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Password</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-white">
                      {showPassword ? savedAccount.game_password : "••••••••"}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="text-muted-foreground hover:text-white"
                    >
                      {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => copyText(savedAccount.game_password!, "Password")}
                      className="text-muted-foreground hover:text-white"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/5 mt-1">
                <span className="text-muted-foreground">Last known balance</span>
                <span className="font-semibold text-white">
                  {lastKnownBalance !== null ? `$${lastKnownBalance.toFixed(2)}` : "—"}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCheckBalance}
              disabled={checkingBalance || pendingCheck || pendingCreate || !savedAccount?.game_username}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50"
            >
              {checkingBalance || pendingCheck ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {pendingCheck ? "Checking balance…" : "Check Balance"}
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              No account yet. Use <strong className="text-white">Create Account</strong> below or
              the button in this panel — free, no wallet charge.
            </p>
          </>
        )}

        {customMode ? (
          <div className="space-y-2 rounded-lg border border-emerald-500/30 bg-black/30 p-3">
            <p className="text-xs font-semibold text-emerald-200">
              {hasSavedAccount ? "Choose login for your replacement account" : "Choose your own login"}
            </p>
            <input
              type="text"
              value={customUsername}
              onChange={(e) =>
                setCustomUsername(
                  e.target.value.replace(/[^a-zA-Z0-9]/g, "").slice(0, maxUsernameLenForGame(game.slug))
                )
              }
              placeholder="Username (7–13 letters & numbers)"
              minLength={7}
              maxLength={maxUsernameLenForGame(game.slug)}
              autoComplete="off"
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-muted-foreground"
            />
            <input
              type="text"
              value={customPassword}
              onChange={(e) =>
                setCustomPassword(e.target.value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 13))
              }
              placeholder="Password (7–13 letters & numbers)"
              minLength={7}
              maxLength={13}
              autoComplete="off"
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-muted-foreground"
            />
            <p className="text-[11px] text-muted-foreground">
              7–13 characters each, letters and numbers only (no symbols). If the name is taken, we&apos;ll
              adjust it to stay unique.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCreateCustom}
                disabled={creating || pendingCreate}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50"
              >
                {creating || pendingCreate ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                {hasSavedAccount ? "Replace with these" : "Create with these"}
              </button>
              <button
                type="button"
                onClick={() => setCustomMode(false)}
                disabled={creating || pendingCreate}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm font-medium text-white hover:bg-white/10 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
                Cancel
              </button>
            </div>
          </div>
        ) : hasSavedAccount ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleCreateAccount()}
              disabled={creating || pendingCreate}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50"
            >
              {creating || pendingCreate ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              {creating ? "Replacing account…" : pendingCreateButtonLabel()}
            </button>
            <button
              type="button"
              onClick={() => setCustomMode(true)}
              disabled={creating || pendingCreate}
              title="Choose your own username & password"
              className="flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-3 text-sm font-medium text-white hover:bg-white/10 disabled:opacity-50"
            >
              <Pencil className="h-4 w-4" />
              <span className="hidden sm:inline">Own login</span>
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleCreateAccount()}
              disabled={creating || pendingCreate}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50"
            >
              {creating || pendingCreate ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              {creating ? "Creating account…" : pendingCreateButtonLabel()}
            </button>
            <button
              type="button"
              onClick={() => setCustomMode(true)}
              disabled={creating || pendingCreate}
              title="Choose your own username & password"
              className="flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-3 text-sm font-medium text-white hover:bg-white/10 disabled:opacity-50"
            >
              <Pencil className="h-4 w-4" />
              <span className="hidden sm:inline">Own login</span>
            </button>
          </div>
        )}

        {hasSavedAccount && !customMode && (
          <p className="text-[11px] text-muted-foreground text-center">
            One account per game — Replace creates a new login on the game panel.
          </p>
        )}

        {pendingCreate && activeCreateLoad && (
          <p className="text-[11px] text-amber-200/80 text-center leading-relaxed">
            An older bot request is still open ({activityLabel(activeCreateLoad)} ·{" "}
            {activeCreateLoad.status}) — you do not need to click again.{" "}
            <button
              type="button"
              onClick={() => void handleCancelLoad(activeCreateLoad.id)}
              disabled={cancellingId === activeCreateLoad.id}
              className="underline font-semibold text-amber-100 hover:text-white disabled:opacity-50"
            >
              {cancellingId === activeCreateLoad.id ? "Cancelling…" : "Cancel it"}
            </button>{" "}
            to unlock Replace Account.
          </p>
        )}

        {anyPending && isAutomatedGameSlug(game.slug) && (
          <p className="text-[11px] text-amber-200/90 text-center leading-relaxed rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
            Processing…
            {createLoadStuck && activeCreateLoad ? (
              <>
                {" "}
                Taking longer than usual —{" "}
                <button
                  type="button"
                  onClick={() => void handleCancelLoad(activeCreateLoad.id)}
                  disabled={cancellingId === activeCreateLoad.id}
                  className="underline font-semibold text-amber-100 hover:text-white disabled:opacity-50"
                >
                  {cancellingId === activeCreateLoad.id ? "Cancelling…" : "Cancel"}
                </button>
              </>
            ) : null}
          </p>
        )}

        {!hasSavedAccount && !customMode && previewAccount && (
          <p className="text-xs text-muted-foreground text-center">
            Will be created as <span className="font-mono text-emerald-300">{previewAccount}</span>{" "}
            (same password)
          </p>
        )}

        {hasSavedAccount && !customMode && previewAccount && usesNumberedAccounts && (
          <p className="text-xs text-muted-foreground text-center">
            Replace will create{" "}
            <span className="font-mono text-emerald-300">{previewAccount}</span> (or the next free
            number if that is taken)
          </p>
        )}
      </div>

      {/* Load / Redeem */}
      <div className="rounded-xl border border-orange-500/20 bg-black/20 p-4 sm:p-5 space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setFundsTab("load")}
            className={cn(
              "flex items-center justify-center gap-2 rounded-xl py-3.5 sm:py-4 px-4 text-sm sm:text-base font-semibold border transition-colors",
              fundsTab === "load"
                ? "border-orange-500/60 bg-gradient-to-r from-orange-500/25 to-red-500/15 text-orange-100 shadow-sm shadow-orange-500/10"
                : "border-white/10 bg-[#2a2a2a] text-muted-foreground hover:border-white/20 hover:text-white"
            )}
          >
            <ArrowDownCircle className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
            Load
          </button>
          <button
            type="button"
            onClick={() => setFundsTab("redeem")}
            className={cn(
              "flex items-center justify-center gap-2 rounded-xl py-3.5 sm:py-4 px-4 text-sm sm:text-base font-semibold border transition-colors",
              fundsTab === "redeem"
                ? "border-amber-500/60 bg-gradient-to-r from-amber-500/25 to-orange-500/15 text-amber-100 shadow-sm shadow-amber-500/10"
                : "border-white/10 bg-[#2a2a2a] text-muted-foreground hover:border-white/20 hover:text-white"
            )}
          >
            <ArrowUpCircle className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
            Redeem
          </button>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#242424]/80 px-4 py-3.5 sm:px-5 sm:py-4">
          <span className="text-xs sm:text-sm text-muted-foreground">
            {fundsTab === "redeem" ? "Deposit Redeem (cashout wallet)" : "Total Deposit"}
          </span>
          <p className="mt-1 text-xl sm:text-2xl font-bold text-white tabular-nums">
            ${(fundsTab === "redeem" ? cashoutWallet : walletBalance).toFixed(2)}
          </p>
          {fundsTab === "redeem" && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Total Deposit stays ${walletBalance.toFixed(2)} — redeem adds to Deposit Redeem, not Total Deposit.
            </p>
          )}
        </div>

        {fundsTab === "load" ? (
          <>
            <p className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Load Credits
            </p>
            <p className="text-sm text-muted-foreground">
              Load from your Total Deposit balance into {game.name}.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base text-muted-foreground">$</span>
                <input
                  type="number"
                  min={WALLET_LOAD_LIMITS.min}
                  max={Math.min(WALLET_LOAD_LIMITS.max, available || WALLET_LOAD_LIMITS.max)}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={!savedAccount}
                  className="w-full rounded-xl border border-white/10 bg-black/30 pl-8 pr-4 py-3.5 sm:py-4 text-base text-white disabled:opacity-50"
                />
              </div>
              <button
                type="button"
                onClick={handleLoad}
                disabled={loading || pendingLoad || !savedAccount || available < WALLET_LOAD_LIMITS.min}
                className="flex w-full sm:w-auto sm:min-w-[132px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 px-6 py-3.5 sm:py-4 text-base font-bold text-black disabled:opacity-50 shrink-0"
              >
                {loading || pendingLoad ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Wallet className="h-5 w-5" />
                )}
                Load
              </button>
            </div>

            {!savedAccount && (
              <p className="text-sm text-amber-400/90">Create your account first, then load credits.</p>
            )}
          </>
        ) : (
          <>
            <p className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Redeem Credits
            </p>
            <p className="text-sm text-muted-foreground">
              Pull credits from your {game.name} account to your Deposit Redeem wallet. Verified KYC required.
            </p>

            {!kycVerified && savedAccount && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-3 text-xs text-amber-100/95 space-y-2">
                <p className="font-semibold text-amber-200 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4" />
                  {kycStatus === "pending"
                    ? "KYC under review — redeem unlocks after admin approval"
                    : "KYC verification required to redeem"}
                </p>
                {kycStatus !== "pending" && (
                  <Link
                    href="/dashboard/kyc"
                    className="inline-flex items-center gap-1 text-amber-300 underline font-semibold hover:text-amber-200"
                  >
                    Complete KYC verification →
                  </Link>
                )}
              </div>
            )}

            {!canRedeem && savedAccount && kycVerified && (
              <p className="text-xs text-amber-400/90">
                Load credits from Total Deposit into this game first, then redeem at {redeemMinMult}x–{redeemMaxMult}x.
              </p>
            )}

            {redeemRulesActive && activeRedeemRollover && (
              <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/90 space-y-1">
                <p className="font-semibold text-amber-200">
                  Deposit redeem rollover (this deposit load)
                </p>
                <p>
                  Last {loadLabel} ${activeRedeemRollover.activeDepositAmount.toFixed(2)} → need{" "}
                  <span className="font-semibold">${activeRedeemRollover.minGameBalance.toFixed(2)}</span>{" "}
                  in game to redeem ({redeemMinMult}x min), up to{" "}
                  <span className="font-semibold">${activeRedeemRollover.maxRedeemRemaining.toFixed(2)}</span>{" "}
                  remaining ({redeemMaxMult}x max for this {loadLabel}).
                </p>
                {lastKnownBalance !== null ? (
                  <p>
                    Last checked balance:{" "}
                    <span
                      className={cn(
                        "font-semibold",
                        redeemBlocked ? "text-red-300" : "text-emerald-300"
                      )}
                    >
                      ${lastKnownBalance.toFixed(2)}
                    </span>
                    {redeemBlocked ? " — play more before redeeming." : " — eligible to redeem."}
                  </p>
                ) : (
                  <p className="text-amber-200/80">
                    Use Check Balance below to see your live game balance before redeeming.
                  </p>
                )}
              </div>
            )}

            <label className="flex items-center gap-2.5 text-sm sm:text-base text-white cursor-pointer py-1">
              <input
                type="checkbox"
                checked={redeemAll}
                onChange={(e) => setRedeemAll(e.target.checked)}
                disabled={!savedAccount}
                className="h-4 w-4 rounded border-white/20"
              />
              Redeem all (zero out game account)
            </label>

            {!redeemAll && (
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base text-muted-foreground">$</span>
                  <input
                    type="number"
                    min={WALLET_LOAD_LIMITS.min}
                    max={redeemMaxAllowed}
                    step="0.01"
                    value={redeemAmount}
                    onChange={(e) => setRedeemAmount(e.target.value)}
                    disabled={!savedAccount}
                    className="w-full rounded-xl border border-white/10 bg-black/30 pl-8 pr-4 py-3.5 sm:py-4 text-base text-white disabled:opacity-50"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleRedeem}
                  disabled={
                    redeeming ||
                    pendingRedeem ||
                    !savedAccount ||
                    !kycVerified ||
                    !canRedeem ||
                    redeemBlocked ||
                    (redeemRulesActive && activeRedeemRollover!.maxRedeemRemaining <= 0)
                  }
                  className="flex w-full sm:w-auto sm:min-w-[132px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-6 py-3.5 sm:py-4 text-base font-bold text-black disabled:opacity-50 shrink-0"
                >
                  {redeeming || pendingRedeem ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <ArrowUpCircle className="h-5 w-5" />
                  )}
                  Redeem
                </button>
              </div>
            )}

            {redeemAll && (
              <button
                type="button"
                onClick={handleRedeem}
                disabled={
                  redeeming ||
                  pendingRedeem ||
                  !savedAccount ||
                  !kycVerified ||
                  !canRedeem ||
                  redeemBlocked ||
                  (redeemRulesActive && activeRedeemRollover!.maxRedeemRemaining <= 0)
                }
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-6 py-3.5 sm:py-4 text-base font-bold text-black disabled:opacity-50"
              >
                {redeeming || pendingRedeem ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <ArrowUpCircle className="h-5 w-5" />
                )}
                Redeem All
              </button>
            )}

            {!savedAccount && (
              <p className="text-sm text-amber-400/90">Create your account first, then redeem credits.</p>
            )}
          </>
        )}
      </div>

      {recentLoads.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-white/10">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Recent activity
          </p>
          {recentLoads.slice(0, 5).map((load) => (
            <div key={load.id} className="rounded-lg bg-black/20 px-3 py-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={
                    load.status === "failed"
                      ? "text-red-400"
                      : load.status === "completed"
                        ? "text-emerald-300"
                        : undefined
                  }
                >
                  {activityLabel(load)}
                  {" · "}
                  {load.status}
                </span>
                <span className="text-muted-foreground shrink-0">
                  {formatRelativeTime(load.created_at)}
                </span>
              </div>
              {(load.status === "pending" || load.status === "processing") && (
                  <div className="mt-1">
                    <button
                      type="button"
                      onClick={() => void handleCancelLoad(load.id)}
                      disabled={cancellingId === load.id}
                      className="text-amber-300/90 underline hover:text-amber-200 disabled:opacity-50 text-[11px]"
                    >
                      {cancellingId === load.id ? "Cancelling…" : "Cancel"}
                    </button>
                  </div>
                )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
