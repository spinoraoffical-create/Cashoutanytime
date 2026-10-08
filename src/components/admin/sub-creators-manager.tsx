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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
        <Stat label="Total sub-creators" value={rows.length.toLocaleString()} />
        <Stat label="Active" value={active.toLocaleString()} />
        <Stat label="Wallet balance" value={`$${wallet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
      </div>

      <form className="flex flex-wrap gap-2" action="/admin/sub-creators">
        <Input name="q" defaultValue={query.q} placeholder="Search name, email, phone, code" className="max-w-xs" />
        <select name="status" defaultValue={query.status ?? "all"} className="h-9 rounded-md border border-border bg-background px-2 text-sm">
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <select name="sort" defaultValue={query.sort ?? "newest"} className="h-9 rounded-md border border-border bg-background px-2 text-sm">
          <option value="newest">Newest</option>
          <option value="name">Name</option>
          <option value="wallet">Wallet</option>
        </select>
        <Button type="submit" variant="outline">Filter</Button>
        <Button variant="outline" asChild>
          <a href={`/admin/sub-creators/export?q=${encodeURIComponent(query.q ?? "")}&status=${query.status ?? "all"}&sort=${query.sort ?? "newest"}`}>Export</a>
        </Button>
        {canAddStore ? <Button type="button" onClick={() => setOpen("store")}>Add store creator</Button> : null}
        <Button type="button" onClick={() => setOpen("sub")}>Add sub-creator</Button>
        {selected.length ? (
          <Button
            type="button"
            variant="outline"
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

      <div className="overflow-x-auto rounded-2xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead />
              <TableHead>Username</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Wallet</TableHead>
              <TableHead>Registered</TableHead>
              <TableHead>Manager</TableHead>
              <TableHead>Players</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="py-8 text-center text-muted-foreground">No agents in your network yet.</TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.userId}>
                  <TableCell>
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
                  </TableCell>
                  <TableCell>
                    <p className="font-semibold">{row.name}</p>
                    <p className="text-xs text-muted-foreground">{row.promoCode}</p>
                  </TableCell>
                  <TableCell>{row.email}</TableCell>
                  <TableCell>{row.phone || "—"}</TableCell>
                  <TableCell>{row.roleLabel.replaceAll("_", " ")}</TableCell>
                  <TableCell>${row.wallet.toFixed(2)}</TableCell>
                  <TableCell>{new Date(row.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>{row.managerName}</TableCell>
                  <TableCell>{row.playerCount}</TableCell>
                  <TableCell>
                    <Badge variant={row.active ? "default" : "outline"}>{row.active ? "Active" : "Inactive"}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <Button type="button" size="sm" variant="outline" onClick={() => setEdit(row)}>Edit</Button>
                      <Button type="button" size="sm" variant="outline" asChild>
                        <Link href={`/admin/players?parent=${row.userId}`}>Players</Link>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (!window.confirm(row.active ? "Deactivate this agent?" : "Activate this agent?")) return;
                          void run(() => setAgentActiveAction(row.userId, !row.active));
                        }}
                      >
                        {row.active ? "Deactivate" : "Activate"}
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setReset(row)}>Reset password</Button>
                      <Button type="button" size="sm" variant="outline" asChild>
                        <Link href={`/admin/sub-creators?focus=${row.userId}`}>Performance</Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

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
          className="rounded-2xl border border-border p-4"
          onSubmit={(event) => {
            event.preventDefault();
            const password = new FormData(event.currentTarget).get("password");
            if (typeof password !== "string") return;
            if (!window.confirm("Set a new password for this agent?")) return;
            void run(() => resetAgentPasswordAction(reset.userId, password));
          }}
        >
          <p className="font-semibold">New password for {reset.name}</p>
          <Input name="password" type="password" minLength={8} required className="mt-2 max-w-xs" />
          <div className="mt-2 flex gap-2">
            <Button type="submit" disabled={busy}>Save password</Button>
            <Button type="button" variant="outline" onClick={() => setReset(null)}>Cancel</Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
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
      className="grid gap-2 rounded-2xl border border-border p-4 sm:grid-cols-2"
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
      <p className="font-semibold sm:col-span-2">{kind === "store" ? "Add store creator" : "Add sub-creator"}</p>
      <Input name="name" placeholder="Name" required />
      <Input name="email" type="email" placeholder="Email" required />
      <Input name="phone" placeholder="Phone" />
      <Input name="password" type="password" placeholder="Temporary password" minLength={8} required />
      {kind === "sub" ? (
        <>
          <select name="parentId" className="h-9 rounded-md border border-border bg-background px-2 text-sm" required={stores.length > 1}>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>{store.name}</option>
            ))}
          </select>
          <select name="roleLabel" className="h-9 rounded-md border border-border bg-background px-2 text-sm">
            <option value="sub_creator">Sub-creator</option>
            <option value="store_sub_creator">Store sub-creator</option>
          </select>
          <Input name="approveLimit" type="number" min={0} step="1" defaultValue={100} placeholder="Approve limit ($)" />
        </>
      ) : null}
      <Input name="commissionBps" type="number" min={0} max={10000} defaultValue={0} placeholder="Commission bps" />
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={busy}>Create</Button>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
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
      className="grid gap-2 rounded-2xl border border-border p-4 sm:grid-cols-2"
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
      <p className="font-semibold sm:col-span-2">Edit {row.name}</p>
      <p className="text-sm text-muted-foreground sm:col-span-2">
        Referral link: /register?ref={row.promoCode} · Estimated commission {row.commissionBps / 100}% · Players {row.playerCount}
      </p>
      <Input name="phone" defaultValue={row.phone} placeholder="Phone" />
      <select name="roleLabel" defaultValue={row.roleLabel} className="h-9 rounded-md border border-border bg-background px-2 text-sm">
        <option value="sub_creator">Sub-creator</option>
        <option value="store_sub_creator">Store sub-creator</option>
        {row.tier === "store_creator" ? <option value="store_creator">Store creator</option> : null}
      </select>
      <Input name="commissionBps" type="number" min={0} max={10000} defaultValue={row.commissionBps} />
      <Input name="approveLimit" type="number" min={0} defaultValue={row.approveLimit ?? 0} />
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={busy}>Save</Button>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
      </div>
    </form>
  );
}
