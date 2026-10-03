"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Ban, Loader2, ShieldCheck, Sparkles, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";

import { ConfirmActionButton } from "@/components/admin/confirm-action-button";
import { GlassCard } from "@/components/shared/glass-card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  adjustBalanceAction,
  adjustWalletAction,
  deleteUserAccountAction,
  recordCashoutPayoutAction,
  setBanAction,
  setUserRolesAction,
} from "@/lib/actions/admin/users";

type AdjustKind = "balance" | "coins" | "xp" | "redeem";

const KIND_META: Record<AdjustKind, { label: string; hint: string }> = {
  balance: { label: "Balance", hint: "Credit or debit the real-money wallet. Use a negative amount to debit." },
  coins: { label: "Rewards", hint: "Credit or debit reward points. Use a negative amount to debit." },
  xp: { label: "XP", hint: "Grant XP. XP cannot be reduced below zero." },
  redeem: { label: "Redeem", hint: "Record a cash-out payout — debits the member's cash-out balance." },
};

type RoleOption = { key: string; name: string };

export function UserManagementPanel({
  userId,
  isBanned,
  walletBalance,
  cashoutWallet,
  coinsBalance,
  allRoles,
  userRoleKeys,
  canManageRoles,
  canDelete,
}: {
  userId: string;
  isBanned: boolean;
  walletBalance: number;
  cashoutWallet: number;
  coinsBalance: number;
  allRoles: RoleOption[];
  userRoleKeys: string[];
  canManageRoles: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  // ban
  const [banReason, setBanReason] = React.useState("");

  // adjust balance / rewards / xp / redeem
  const [adjustOpen, setAdjustOpen] = React.useState(false);
  const [kind, setKind] = React.useState<AdjustKind>("balance");
  const [amount, setAmount] = React.useState("");
  const [note, setNote] = React.useState("");

  // roles
  const [selectedRoles, setSelectedRoles] = React.useState<Set<string>>(
    new Set(userRoleKeys)
  );

  function toggleBan() {
    startTransition(async () => {
      const result = await setBanAction({
        userId,
        banned: !isBanned,
        reason: banReason || undefined,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Updated");
      setBanReason("");
      router.refresh();
    });
  }

  function adjust() {
    const n = Number(amount);
    if (!Number.isFinite(n) || n === 0) {
      toast.error("Enter a non-zero amount.");
      return;
    }
    if (kind === "redeem" && n <= 0) {
      toast.error("Redeem amount must be positive.");
      return;
    }
    startTransition(async () => {
      const result =
        kind === "balance"
          ? await adjustWalletAction({ userId, amount: n, note })
          : kind === "redeem"
            ? await recordCashoutPayoutAction({ userId, amount: n, note })
            : await adjustBalanceAction({ userId, currency: kind, amount: n, note });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Done");
      setAdjustOpen(false);
      setAmount("");
      setNote("");
      router.refresh();
    });
  }

  function saveRoles() {
    startTransition(async () => {
      const result = await setUserRolesAction({
        userId,
        roleKeys: [...selectedRoles],
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Roles updated");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {/* ── balance / rewards / xp / redeem ── */}
      <GlassCard className="p-6">
        <h3 className="flex items-center gap-2 font-bold">
          <Wallet className="size-4 text-ws-gold-deep dark:text-ws-gold" aria-hidden />
          Balance &amp; rewards
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Credit/debit the real-money wallet, adjust rewards/XP, or record a cash-out
          payout. Every action is audit-logged.
        </p>
        <dl className="mt-4 grid grid-cols-3 gap-3">
          <div>
            <dt className="hud-label text-muted-foreground">Wallet</dt>
            <dd className="tnum mt-1 font-bold text-ws-gold-deep dark:text-ws-gold">
              ${walletBalance.toFixed(2)}
            </dd>
          </div>
          <div>
            <dt className="hud-label text-muted-foreground">Cash-out</dt>
            <dd className="tnum mt-1 font-bold text-ws-emerald">
              ${cashoutWallet.toFixed(2)}
            </dd>
          </div>
          <div>
            <dt className="hud-label text-muted-foreground">Coins</dt>
            <dd className="tnum mt-1 font-bold text-ws-green-deep dark:text-ws-green">
              {coinsBalance.toLocaleString()}
            </dd>
          </div>
        </dl>
        <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="mt-4">
              <Sparkles className="size-4" aria-hidden />
              New adjustment
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-strong">
            <DialogHeader>
              <DialogTitle>{KIND_META[kind].label} adjustment</DialogTitle>
              <DialogDescription>{KIND_META[kind].hint}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-2">
                {(Object.keys(KIND_META) as AdjustKind[]).map((k) => (
                  <Button
                    key={k}
                    type="button"
                    variant={kind === k ? "default" : "outline"}
                    size="sm"
                    onClick={() => setKind(k)}
                  >
                    {KIND_META[k].label}
                  </Button>
                ))}
              </div>
              <div className="space-y-2">
                <Label htmlFor="adjust-amount">
                  Amount {kind === "balance" || kind === "redeem" ? "($)" : "(points)"}
                </Label>
                <Input
                  id="adjust-amount"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={kind === "redeem" ? "e.g. 50" : "e.g. 500 or -200"}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adjust-note">Reason</Label>
                <Textarea
                  id="adjust-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="Why is this being made?"
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={adjust} disabled={pending}>
                {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
                Apply {KIND_META[kind].label.toLowerCase()}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </GlassCard>

      {/* ── roles ── */}
      {canManageRoles && (
        <GlassCard className="p-6">
          <h3 className="flex items-center gap-2 font-bold">
            <ShieldCheck className="size-4 text-ws-emerald" aria-hidden />
            Roles
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Grant staff access. Changes take effect on the member&apos;s next request.
          </p>
          <div className="mt-4 space-y-2">
            {allRoles.map((role) => (
              <label
                key={role.key}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-foreground/5"
              >
                <Checkbox
                  checked={selectedRoles.has(role.key)}
                  onCheckedChange={(v) => {
                    setSelectedRoles((prev) => {
                      const next = new Set(prev);
                      if (v) next.add(role.key);
                      else next.delete(role.key);
                      return next;
                    });
                  }}
                />
                <span className="text-sm">{role.name}</span>
              </label>
            ))}
          </div>
          <Button
            size="sm"
            className="mt-4"
            onClick={saveRoles}
            disabled={pending}
          >
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Save roles
          </Button>
        </GlassCard>
      )}

      {/* ── ban ── */}
      <GlassCard className="border-ws-danger/20 p-6">
        <h3 className="flex items-center gap-2 font-bold text-ws-danger">
          <Ban className="size-4" aria-hidden />
          {isBanned ? "Reinstate member" : "Ban member"}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {isBanned
            ? "This member is currently banned and cannot claim rewards or sign in to play."
            : "Banning blocks claims, referrals and gameplay immediately."}
        </p>
        {!isBanned && (
          <Input
            value={banReason}
            onChange={(e) => setBanReason(e.target.value)}
            placeholder="Reason (shown in audit log)"
            className="mt-4"
          />
        )}
        <Button
          variant={isBanned ? "outline" : "destructive"}
          size="sm"
          className="mt-4"
          onClick={toggleBan}
          disabled={pending}
        >
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {isBanned ? "Reinstate member" : "Ban member"}
        </Button>
      </GlassCard>

      {/* ── delete ── */}
      {canDelete && (
        <GlassCard className="border-ws-danger/20 p-6">
          <h3 className="flex items-center gap-2 font-bold text-ws-danger">
            <Trash2 className="size-4" aria-hidden />
            Delete account
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Permanently deletes the login, profile, wallet and ledger history. This cannot
            be undone.
          </p>
          <div className="mt-4">
            <ConfirmActionButton
              action={deleteUserAccountAction.bind(null, userId)}
              title="Permanently delete this account?"
              description="This permanently deletes the login, profile, wallet, ledger, and all associated data. This cannot be undone."
              confirmLabel="Delete account"
              triggerLabel="Delete account"
              redirectTo="/admin/users"
            />
          </div>
        </GlassCard>
      )}
    </div>
  );
}
