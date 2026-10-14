"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  createAgentAction,
  resetAgentPasswordAction,
  setAgentActiveAction,
  setAgentsActiveAction,
  updateAgentAction,
  type AgentRow,
} from "@/lib/actions/agents";
import { AdminSectionCard } from "@/components/admin/ui/admin-section-card";
import { AdminStatCard } from "@/components/admin/ui/admin-stat-card";
import { AdminStatusBadge } from "@/components/admin/ui/admin-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const fieldClass = "h-9 rounded-md border border-white/10 bg-[#0b1224] px-2 text-sm text-white";
const inputClass = "border-white/10 bg-[#0b1224] text-white placeholder:text-[#8ea0c3]";

function roleName(label: string) {
  if (label === "store_creator") return "Store";
  if (label === "sub_creator") return "Sub-creator";
  if (label === "store_sub_creator") return "Store sub-creator";
  return label.replaceAll("_", " ");
}

export function SubCreatorsManager({
  rows,
  stores,
  canAddStore,
  query,
}: {
  rows: AgentRow[];
  stores: { id: string; name: string }[];
  canAddStore: boolean;
  query: { q?: string; status?: string; sort?: string };
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [open, setOpen] = useState<"store" | "sub" | null>(null);
  const [edit, setEdit] = useState<AgentRow | null>(null);
  const [reset, setReset] = useState<AgentRow | null>(null);
  const [busy, setBusy] = useState(false);
  const active = rows.filter((row) => row.active).length;
  const wallet = rows.reduce((sum, row) => sum + row.wallet, 0);

  async function run(task: () => Promise<{ ok: boolean; error?: string; message?: string }>) {
    setBusy(true);
    const result = await task();
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error ?? "Could not save.");
      return;
    }
    toast.success(result.message ?? "Saved.");
    setOpen(null);
    setEdit(null);
    setReset(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <AdminStatCard label="Accounts in this list" value={rows.length.toLocaleString()} hint="Stores and sub-creators that match the current search and status filter." />
        <AdminStatCard label="Active" value={active.toLocaleString()} hint="Accounts marked active in this list." />
        <AdminStatCard
          label="Wallet balance"
          value={`$${wallet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          hint="Sum of the wallet balances stored on these accounts. This is not profit and it is not a payout."
        />
      </div>

      <form className="flex flex-wrap gap-2" action="/admin/sub-creators">
        <Input name="q" defaultValue={query.q} placeholder="Search name, email, phone, code" aria-label="Search stores and sub-creators" className={`max-w-xs ${inputClass}`} />
        <select name="status" defaultValue={query.status ?? "all"} aria-label="Account status" className={fieldClass}>
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <select name="sort" defaultValue={query.sort ?? "newest"} aria-label="Sort accounts" className={fieldClass}>
          <option value="newest">Newest</option>
          <option value="name">Name</option>
          <option value="wallet">Wallet</option>
        </select>
        <Button type="submit" variant="outline" className="border-white/15 bg-transparent text-white">Filter</Button>
        <Button variant="outline" className="border-white/15 bg-transparent text-white" asChild>
          <a href={`/admin/sub-creators/export?q=${encodeURIComponent(query.q ?? "")}&status=${query.status ?? "all"}&sort=${query.sort ?? "newest"}`}>Export</a>
        </Button>
        {canAddStore ? <Button type="button" onClick={() => setOpen("store")}>Add store</Button> : null}
        <Button type="button" onClick={() => setOpen("sub")}>Add sub-creator</Button>
        {selected.length ? (
          <Button
            type="button"
            variant="outline"
            className="border-white/15 bg-transparent text-white"
            disabled={busy}
            onClick={() => {
              if (!window.confirm(`Deactivate ${selected.length} agent(s)?`)) return;
              void run(() => setAgentsActiveAction(selected, false));
            }}
          >
            Deactivate selected
          </Button>
        ) : null}
      </form>
      <p className="text-sm text-[#9fb0d0]">
        Add store and add sub-creator create accounts. Deactivate, edit, and password reset change an existing account. None of these buttons send a payment or change a player wallet.
      </p>

      <AdminSectionCard title="Directory" description="A store sits under the platform. A sub-creator sits under one store. Players are assigned separately.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[64rem] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-[#8ea0c3]">
                <th className="px-2 py-2 font-medium" />
                <th className="px-2 py-2 font-medium">Account</th>
                <th className="px-2 py-2 font-medium">Email</th>
                <th className="px-2 py-2 font-medium">Phone</th>
                <th className="px-2 py-2 font-medium">Kind</th>
                <th className="px-2 py-2 font-medium">Wallet</th>
                <th className="px-2 py-2 font-medium">Opened</th>
                <th className="px-2 py-2 font-medium">Managed by</th>
                <th className="px-2 py-2 font-medium">Players</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">Account actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-[#9fb0d0]">No stores or sub-creators match this view.</td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.userId} className="border-b border-white/5 last:border-0">
                    <td className="px-2 py-3">
                      <input
                        type="checkbox"
                        checked={selected.includes(row.userId)}
                        onChange={(event) =>
                          setSelected((current) =>
                            event.target.checked ? [...current, row.userId] : current.filter((id) => id !== row.userId)
                          )
                        }
                        aria-label={`Select ${row.name}`}
                      />
                    </td>
                    <td className="px-2 py-3">
                      <p className="font-semibold text-white">{row.name}</p>
                      <p className="text-xs text-[#9fb0d0]">{row.promoCode}</p>
                    </td>
                    <td className="px-2 py-3 text-[#e8eefc]">{row.email}</td>
                    <td className="px-2 py-3 text-[#e8eefc]">{row.phone || "—"}</td>
                    <td className="px-2 py-3 text-[#e8eefc]">{roleName(row.roleLabel)}</td>
                    <td className="px-2 py-3 text-[#e8eefc]">${row.wallet.toFixed(2)}</td>
                    <td className="px-2 py-3 text-[#e8eefc]">{new Date(row.createdAt).toLocaleDateString()}</td>
                    <td className="px-2 py-3 text-[#e8eefc]">{row.managerName}</td>
                    <td className="px-2 py-3 text-[#e8eefc]">{row.playerCount}</td>
                    <td className="px-2 py-3">
                      <AdminStatusBadge status={row.active ? "Active" : "Inactive"} />
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex flex-wrap gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="border-white/15 bg-transparent text-white"
                          onClick={() => {
                            const url = `${window.location.origin}/r/${row.promoCode}`;
                            void navigator.clipboard.writeText(url).then(
                              () => toast.success("Referral link copied."),
                              () => toast.error("Could not copy the referral link.")
                            );
                          }}
                        >
                          Referral Link
                        </Button>
                        <Button type="button" size="sm" variant="outline" className="border-white/15 bg-transparent text-white" onClick={() => setEdit(row)}>Edit</Button>
                        <Button type="button" size="sm" variant="outline" className="border-white/15 bg-transparent text-white" asChild>
                          <Link href={`/admin/players?parent=${row.userId}`}>Players</Link>
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="border-white/15 bg-transparent text-white"
                          onClick={() => {
                            if (!window.confirm(row.active ? "Deactivate this agent?" : "Activate this agent?")) return;
                            void run(() => setAgentActiveAction(row.userId, !row.active));
                          }}
                        >
                          {row.active ? "Deactivate" : "Activate"}
                        </Button>
                        <Button type="button" size="sm" variant="outline" className="border-white/15 bg-transparent text-white" onClick={() => setReset(row)}>Reset password</Button>
                        <Button type="button" size="sm" variant="outline" className="border-white/15 bg-transparent text-white" asChild>
                          <Link href={`/admin/sub-creators?focus=${row.userId}`}>Account</Link>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </AdminSectionCard>

      {open ? (
        <AgentForm
          kind={open}
          stores={stores}
          busy={busy}
          onClose={() => setOpen(null)}
          onSubmit={(payload) => void run(() => createAgentAction(payload))}
        />
      ) : null}
      {edit ? (
        <EditForm
          row={edit}
          busy={busy}
          onClose={() => setEdit(null)}
          onSubmit={(payload) => void run(() => updateAgentAction(payload))}
        />
      ) : null}
      {reset ? (
        <form
          className="rounded-2xl border border-white/10 bg-[#10182e]/80 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            const password = new FormData(event.currentTarget).get("password");
            if (typeof password !== "string") return;
            if (!window.confirm("Set a new password for this agent?")) return;
            void run(() => resetAgentPasswordAction(reset.userId, password));
          }}
        >
          <p className="font-semibold text-white">New password for {reset.name}</p>
          <p className="mt-1 text-sm text-[#9fb0d0]">This changes the sign-in password. It does not change a wallet.</p>
          <Input name="password" type="password" minLength={8} required className={`mt-2 max-w-xs ${inputClass}`} />
          <div className="mt-2 flex gap-2">
            <Button type="submit" disabled={busy}>Save password</Button>
            <Button type="button" variant="outline" className="border-white/15 bg-transparent text-white" onClick={() => setReset(null)}>Cancel</Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function AgentForm({
  kind,
  stores,
  busy,
  onClose,
  onSubmit,
}: {
  kind: "store" | "sub";
  stores: { id: string; name: string }[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    name: string;
    email: string;
    phone: string;
    password: string;
    kind: "store_creator" | "sub_creator";
    roleLabel?: "sub_creator" | "store_sub_creator";
    parentId?: string | null;
    commissionBps: number;
    approveLimit?: number;
  }) => void;
}) {
  return (
    <form
      className="grid gap-2 rounded-2xl border border-white/10 bg-[#10182e]/80 p-4 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        onSubmit({
          name: String(form.get("name") ?? ""),
          email: String(form.get("email") ?? ""),
          phone: String(form.get("phone") ?? ""),
          password: String(form.get("password") ?? ""),
          kind: kind === "store" ? "store_creator" : "sub_creator",
          roleLabel: kind === "store" ? undefined : (String(form.get("roleLabel")) as "sub_creator" | "store_sub_creator"),
          parentId: kind === "store" ? null : String(form.get("parentId") ?? "") || null,
          commissionBps: Number(form.get("commissionBps") ?? 0),
          approveLimit: kind === "store" ? undefined : Number(form.get("approveLimit") ?? 100),
        });
      }}
    >
      <div className="sm:col-span-2">
        <p className="font-semibold text-white">{kind === "store" ? "Add store" : "Add sub-creator"}</p>
        <p className="mt-1 text-sm text-[#9fb0d0]">
          {kind === "store"
            ? "This creates a store account under the platform. It does not move money."
            : "This creates a sub-creator under the store you choose. It does not move money."}
        </p>
      </div>
      <Input name="name" placeholder="Name" required className={inputClass} />
      <Input name="email" type="email" placeholder="Email" required className={inputClass} />
      <Input name="phone" placeholder="Phone" className={inputClass} />
      <Input name="password" type="password" placeholder="Temporary password" minLength={8} required className={inputClass} />
      {kind === "sub" ? (
        <>
          <select name="parentId" aria-label="Store" className={fieldClass} required={stores.length > 1}>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>{store.name}</option>
            ))}
          </select>
          <select name="roleLabel" aria-label="Sub-creator kind" className={fieldClass}>
            <option value="sub_creator">Sub-creator</option>
            <option value="store_sub_creator">Store sub-creator</option>
          </select>
          <Input name="approveLimit" type="number" min={0} step="1" defaultValue={100} placeholder="Approve limit ($)" aria-label="Deposit approval limit" className={inputClass} />
        </>
      ) : null}
      <Input name="commissionBps" type="number" min={0} max={10000} defaultValue={0} placeholder="Commission bps" aria-label="Commission rate in basis points" className={inputClass} />
      <p className="text-xs text-[#8ea0c3] sm:col-span-2">Commission is stored in basis points. 100 basis points is 1%. Saving it does not pay commission.</p>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={busy}>Create</Button>
        <Button type="button" variant="outline" className="border-white/15 bg-transparent text-white" onClick={onClose}>Cancel</Button>
      </div>
    </form>
  );
}

function EditForm({
  row,
  busy,
  onClose,
  onSubmit,
}: {
  row: AgentRow;
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    userId: string;
    phone: string;
    roleLabel: "sub_creator" | "store_sub_creator" | "store_creator";
    commissionBps: number;
    approveLimit: number;
  }) => void;
}) {
  return (
    <form
      className="grid gap-2 rounded-2xl border border-white/10 bg-[#10182e]/80 p-4 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        onSubmit({
          userId: row.userId,
          phone: String(form.get("phone") ?? ""),
          roleLabel: String(form.get("roleLabel")) as "sub_creator" | "store_sub_creator" | "store_creator",
          commissionBps: Number(form.get("commissionBps") ?? 0),
          approveLimit: Number(form.get("approveLimit") ?? 0),
        });
      }}
    >
      <div className="sm:col-span-2">
        <p className="font-semibold text-white">Edit {row.name}</p>
        <p className="mt-1 text-sm text-[#9fb0d0]">
          Signup code {row.promoCode} stays on this account. Stored commission rate {(row.commissionBps / 100).toFixed(2)}%. Players assigned directly: {row.playerCount}. Saving does not move money.
        </p>
      </div>
      <Input name="phone" defaultValue={row.phone} placeholder="Phone" className={inputClass} />
      <select name="roleLabel" defaultValue={row.roleLabel} aria-label="Account kind" className={fieldClass}>
        <option value="sub_creator">Sub-creator</option>
        <option value="store_sub_creator">Store sub-creator</option>
        {row.tier === "store_creator" ? <option value="store_creator">Store</option> : null}
      </select>
      <Input name="commissionBps" type="number" min={0} max={10000} defaultValue={row.commissionBps} aria-label="Commission rate in basis points" className={inputClass} />
      <Input name="approveLimit" type="number" min={0} defaultValue={row.approveLimit ?? 0} aria-label="Deposit approval limit" className={inputClass} />
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={busy}>Save</Button>
        <Button type="button" variant="outline" className="border-white/15 bg-transparent text-white" onClick={onClose}>Cancel</Button>
      </div>
    </form>
  );
}
