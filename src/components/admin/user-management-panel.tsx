"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Ban, Loader2, ShieldCheck, Sparkles, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";

import { ConfirmActionButton } from "@/components/admin/confirm-action-button";
import { AdminSectionCard } from "@/components/admin/ui/admin-section-card";
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
  balance: { label: "Balance", hint: "Adds or removes money from the play wallet. Use a negative amount to remove money." },
  coins: { label: "Rewards", hint: "Adds or removes reward points. Use a negative amount to remove points." },
  xp: { label: "XP", hint: "Adds experience. Experience cannot go below zero." },
  redeem: { label: "Redeem", hint: "Records a cash-out and removes that amount from the cash-out wallet." },
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
      if (result.auditWarning) toast.warning(result.auditWarning);
      else toast.success(result.message ?? "Updated");
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
    if (
      !window.confirm(
        `Apply this ${KIND_META[kind].label.toLowerCase()} change of ${n}? This updates the player and is written to the audit log.`
      )
    ) {
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
      if (result.auditWarning) toast.warning(result.auditWarning);
      else toast.success(result.message ?? "Done");
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
      if (result.auditWarning) toast.warning(result.auditWarning);
      else toast.success(result.message ?? "Roles updated");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <AdminSectionCard
        title="Account actions"
        description="These buttons change the player. The account details beside this card are read-only. Every change is logged."
      >
        <p className="text-sm text-[#9fb0d0]">Use a button only when you mean to change a balance, a role, or access.</p>
      </AdminSectionCard>
      <AdminSectionCard
        title="Balance changes"
        description="Choose Balance, Rewards, XP, or Redeem. Balance changes the play wallet. Redeem records a cash-out from the cash-out wallet."
        action={<Wallet className="size-4 text-cyan-200" aria-hidden />}
      >
        <dl className="grid grid-cols-3 gap-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-[#8ea0c3]">Play wallet</dt>
            <dd className="mt-1 font-semibold tabular-nums text-white">${walletBalance.toFixed(2)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-[#8ea0c3]">Cash-out</dt>
            <dd className="mt-1 font-semibold tabular-nums text-white">${cashoutWallet.toFixed(2)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-[#8ea0c3]">Coins</dt>
            <dd className="mt-1 font-semibold tabular-nums text-white">{coinsBalance.toLocaleString()}</dd>
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
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
      </AdminSectionCard>

      {canManageRoles && (
        <AdminSectionCard
          title="Staff roles"
          description="Changes who this person can act as. The new roles apply on their next request."
          action={<ShieldCheck className="size-4 text-emerald-200" aria-hidden />}
        >
          <div className="mt-4 space-y-2">
            {allRoles.map((role) => (
              <label
                key={role.key}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-[#e8eefc] hover:bg-white/5"
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
        </AdminSectionCard>
      )}

      <AdminSectionCard
        className="border-rose-400/30"
        title={isBanned ? "Restore access" : "Block access"}
        description={
          isBanned
            ? "This player is currently blocked from rewards and play. Restoring access uses the existing ban action."
            : "Blocking stops claims, referrals, and play immediately. This uses the existing ban action."
        }
        action={<Ban className="size-4 text-rose-200" aria-hidden />}
      >
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
          {isBanned ? "Restore access" : "Block access"}
        </Button>
      </AdminSectionCard>

      {canDelete && (
        <AdminSectionCard
          className="border-rose-400/30"
          title="Delete account"
          description="An empty account is deleted. An account with a balance, KYC, or reward history is closed instead: the login is disabled and those records stay."
          action={<Trash2 className="size-4 text-rose-200" aria-hidden />}
        >
          <div className="mt-4">
            <ConfirmActionButton
              action={deleteUserAccountAction.bind(null, userId)}
              title="Close this account?"
              description="An empty account is deleted. An account with a balance, KYC, or reward history keeps those records, disables the login, and does not reopen welcome Coins."
              confirmLabel="Close account"
              triggerLabel="Delete account"
              redirectTo="/admin/users"
            />
          </div>
        </AdminSectionCard>
      )}
    </div>
  );
}
