"use client";

import { useActionState } from "react";

import { pauseLoyaltyEarningAction, saveLoyaltyControlsAction, updateLoyaltyTaskAction } from "@/lib/actions/admin/loyalty";

type Notice = { ok: boolean; error?: string; message?: string } | null;

export function LoyaltyPauseButton() {
  const [state, action, pending] = useActionState(async () => pauseLoyaltyEarningAction(), null);
  return (
    <form action={action} className="mt-3">
      <button className="rounded-lg bg-[#ff6b89] px-3 py-2 font-bold text-[#3a1020]" type="submit" disabled={pending}>
        {pending ? "Pausing…" : "Pause Coins earning"}
      </button>
      {state && !state.ok ? <p className="mt-1 text-sm text-[#ff8aa0]">{state.error}</p> : null}
      {state?.ok ? <p className="mt-1 text-sm text-[#b8f3c8]">Coins earning is paused. The $1 freeplay check-in was not changed.</p> : null}
    </form>
  );
}

export function LoyaltyTaskForm({
  taskKey,
  label,
  help,
  coins,
  enabled,
  completions,
  issued,
}: {
  taskKey: string;
  label: string;
  help: string;
  coins: number;
  enabled: boolean;
  completions: number;
  issued: number;
}) {
  const [state, action, pending] = useActionState(async (_previous: Notice, formData: FormData) => {
    return updateLoyaltyTaskAction({
      key: taskKey,
      coins: Number(formData.get("coins")),
      enabled: formData.get("enabled") === "on",
    });
  }, null);

  return (
    <form action={action} className="grid gap-2 rounded-xl border border-white/10 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-semibold text-white">{label}</span>
        <span className="text-xs text-[#9fb0d0]">{completions.toLocaleString()} completed · {issued.toLocaleString()} Coins issued</span>
      </div>
      <p className="text-xs text-[#9fb0d0]">{help}</p>
      <div className="flex flex-wrap items-center gap-3">
        <label>
          Coins
          <input name="coins" type="number" min={0} max={10000} defaultValue={coins} className="ml-2 w-24 rounded-md border bg-transparent px-2 py-1" />
        </label>
        <label className="flex items-center gap-2">
          <input name="enabled" type="checkbox" defaultChecked={enabled} />
          On
        </label>
        <button className="rounded-md border border-white/20 px-2 py-1" type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
      {state && !state.ok ? <p className="text-sm text-[#ff8aa0]">{state.error}</p> : null}
      {state?.ok && "message" in state && state.message ? <p className="text-sm text-[#b8f3c8]">{state.message}</p> : null}
    </form>
  );
}

export function LoyaltyControlsForm({
  initial,
}: {
  initial: {
    earning: boolean;
    deposit: boolean;
    legacy: boolean;
    checkin: boolean;
    rate: number;
    minDollars: number;
    maxPerTx: number;
    maxPerPlayerMonth: number;
    playerMonthCap: number;
    globalBudget: number;
  };
}) {
  const [state, action, pending] = useActionState(async (_previous: Notice, formData: FormData) => {
    return saveLoyaltyControlsAction({
      earning: formData.get("earning") === "on",
      deposit: formData.get("deposit") === "on",
      legacy: formData.get("legacy") === "on",
      checkin: formData.get("checkin") === "on",
      rate: Number(formData.get("rate")),
      minDollars: Number(formData.get("minDollars")),
      maxPerTx: Number(formData.get("maxPerTx")),
      maxPerPlayerMonth: Number(formData.get("maxPerPlayerMonth")),
      playerMonthCap: Number(formData.get("playerMonthCap")),
      globalBudget: Number(formData.get("globalBudget")),
    });
  }, null);

  return (
    <form action={action} className="mt-4 grid gap-2 rounded-xl border border-white/10 p-3">
      <label className="flex items-center gap-2"><input name="earning" type="checkbox" defaultChecked={initial.earning} /> Coins earning</label>
      <label className="flex items-center gap-2"><input name="legacy" type="checkbox" defaultChecked={initial.legacy} /> $1 freeplay check-in</label>
      <label className="flex items-center gap-2"><input name="checkin" type="checkbox" defaultChecked={initial.checkin} /> Coin check-in</label>
      <p className="text-xs text-[#9fb0d0]">Only one check-in can be on. Pausing Coins does not change these boxes. Redemption cannot be turned on here.</p>
      <label className="flex items-center gap-2"><input name="deposit" type="checkbox" defaultChecked={initial.deposit} /> Deposit Coins</label>
      <p className="text-xs text-[#9fb0d0]">Leave Deposit Coins off until that reward is approved. Refunds pull Coins back. Coins already spent are recorded as unrecovered and still count against the budget.</p>
      <label>Coins per deposit dollar <input name="rate" type="number" min={0} max={100} defaultValue={initial.rate} className="ml-2 w-20 rounded-md border bg-transparent px-2 py-1" /></label>
      <label>Minimum deposit dollars <input name="minDollars" type="number" min={0} max={10000} defaultValue={initial.minDollars} className="ml-2 w-20 rounded-md border bg-transparent px-2 py-1" /></label>
      <label>Maximum Coins per deposit <input name="maxPerTx" type="number" min={0} max={100000} defaultValue={initial.maxPerTx} className="ml-2 w-24 rounded-md border bg-transparent px-2 py-1" /></label>
      <label>Deposit Coins per player each month <input name="maxPerPlayerMonth" type="number" min={0} max={100000} defaultValue={initial.maxPerPlayerMonth} className="ml-2 w-24 rounded-md border bg-transparent px-2 py-1" /></label>
      <label>Player monthly Coin cap <input name="playerMonthCap" type="number" min={0} max={30000} defaultValue={initial.playerMonthCap} className="ml-2 w-24 rounded-md border bg-transparent px-2 py-1" /></label>
      <label>Global Coin budget <input name="globalBudget" type="number" min={0} max={30000} defaultValue={initial.globalBudget} className="ml-2 w-24 rounded-md border bg-transparent px-2 py-1" /></label>
      <p className="text-xs text-[#9fb0d0]">The global budget cannot be raised above 30,000 Coins, which is a $30 freeplay liability if redemption is ever allowed. It can be lowered.</p>
      {state && !state.ok ? <p className="text-sm text-[#ff8aa0]">{state.error}</p> : null}
      {state?.ok && "message" in state && state.message ? <p className="text-sm text-[#b8f3c8]">{state.message}</p> : null}
      <button className="w-fit rounded-md border border-white/20 px-3 py-1" type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save Coin settings"}
      </button>
    </form>
  );
}
