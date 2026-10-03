"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Banknote, Coins, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createGameAccount, loadToGame, redeemFromGame } from "@/lib/actions/game";

export function CreateAccountButton({
  gameId,
  gameName,
}: {
  gameId: string;
  gameName: string;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await createGameAccount(gameId);
          if (r.ok) {
            toast.success(`Creating your ${gameName} account — login arrives shortly.`);
            router.refresh();
          } else {
            toast.error(r.error);
          }
        })
      }
    >
      {pending ? (
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
      ) : (
        <Plus className="size-3.5" aria-hidden />
      )}
      Create
    </Button>
  );
}

export function LoadCreditsButton({
  gameId,
  walletBalance,
}: {
  gameId: string;
  walletBalance: number;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [amount, setAmount] = React.useState("");
  const [pending, start] = React.useTransition();

  if (walletBalance <= 0) {
    return (
      <Button asChild size="sm" variant="outline" className="shrink-0">
        <Link href="/dashboard/deposit">
          <Plus className="size-3.5" aria-hidden />
          Add funds
        </Link>
      </Button>
    );
  }

  if (!open) {
    return (
      <Button size="sm" variant="outline" className="shrink-0" onClick={() => setOpen(true)}>
        <Coins className="size-3.5" aria-hidden />
        Load
      </Button>
    );
  }

  function submit() {
    const amt = Math.floor(Number(amount));
    if (!amt || amt <= 0) {
      toast.error("Enter an amount.");
      return;
    }
    if (amt > walletBalance) {
      toast.error("Not enough wallet balance.");
      return;
    }
    start(async () => {
      const r = await loadToGame(gameId, amt);
      if (r.ok) {
        toast.success(`Loading ${amt} credits to your account…`);
        setOpen(false);
        setAmount("");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      <Input
        type="number"
        min="1"
        max={walletBalance}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="$"
        className="h-8 w-20"
        autoFocus
      />
      <Button size="sm" disabled={pending} onClick={submit}>
        {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : "Go"}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          setOpen(false);
          setAmount("");
        }}
      >
        ✕
      </Button>
    </div>
  );
}

export function RedeemButton({
  gameId,
  gameBalance,
}: {
  gameId: string;
  gameBalance: number;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [amount, setAmount] = React.useState("");
  const [pending, start] = React.useTransition();

  function run(amt: number, all: boolean) {
    start(async () => {
      const r = await redeemFromGame(gameId, amt, all);
      if (r.ok) {
        toast.success("Cash-out requested — credits go to your cash-out wallet.");
        setOpen(false);
        setAmount("");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  if (!open) {
    return (
      <Button size="sm" variant="ghost" className="shrink-0" onClick={() => setOpen(true)}>
        <Banknote className="size-3.5" aria-hidden />
        Cash out
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <Input
        type="number"
        min="1"
        max={gameBalance}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="$"
        className="h-8 w-20"
        autoFocus
      />
      <Button
        size="sm"
        disabled={pending}
        onClick={() => {
          const amt = Math.floor(Number(amount));
          if (!amt || amt <= 0) return toast.error("Enter an amount.");
          if (amt > gameBalance) return toast.error("More than your game balance.");
          run(amt, false);
        }}
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : "Go"}
      </Button>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => run(0, true)}>
        All
      </Button>
      <Button size="sm" variant="ghost" onClick={() => { setOpen(false); setAmount(""); }}>
        ✕
      </Button>
    </div>
  );
}
