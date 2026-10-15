"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { movePlayerAction, type NetworkPlayer } from "@/lib/actions/agents";
import { AdminEmptyState } from "@/components/admin/ui/admin-empty-state";
import { AdminStatusBadge } from "@/components/admin/ui/admin-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function NetworkPlayers({
  rows,
  parents,
  canMove,
  showParentFilter,
  showIp,
  query,
}: {
  rows: NetworkPlayer[];
  parents: { id: string; name: string }[];
  canMove: boolean;
  showParentFilter: boolean;
  showIp: boolean;
  query: { q?: string; parent?: string };
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [parentId, setParentId] = useState(parents[0]?.id ?? "");
  const [busy, setBusy] = useState(false);

  return (
    <div className="space-y-4">
      <form className="flex flex-col gap-2 lg:flex-row lg:flex-wrap" action="/admin/players">
        <Input name="q" defaultValue={query.q} placeholder="Search name, phone, email, sub-creator, or store" className="max-w-md border-white/10 bg-[#0b1224] text-white placeholder:text-[#8ea0c3]" aria-label="Search network players" />
        {showParentFilter ? (
          <select name="parent" defaultValue={query.parent ?? "all"} aria-label="Filter by store or sub-creator" className="h-9 rounded-md border border-white/10 bg-[#0b1224] px-2 text-sm text-white">
            <option value="all">All stores and sub-creators</option>
            {parents.map((parent) => (
              <option key={parent.id} value={parent.id}>{parent.name}</option>
            ))}
          </select>
        ) : null}
        <Button type="submit" variant="outline" className="border-white/15 bg-transparent text-white">Filter</Button>
        <Button variant="outline" className="border-white/15 bg-transparent text-white" asChild>
          <a href={`/admin/players/export?q=${encodeURIComponent(query.q ?? "")}&parent=${query.parent ?? "all"}`}>Export</a>
        </Button>
      </form>

      {canMove && selected.length ? (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!window.confirm(`Move ${selected.length} player(s)?`)) return;
            setBusy(true);
            void (async () => {
              let auditWarning: string | undefined;
              for (const id of selected) {
                const result = await movePlayerAction(id, parentId);
                if (!result.ok) {
                  toast.error(result.error ?? "Could not move a player.");
                  setBusy(false);
                  return;
                }
                if (result.auditWarning) auditWarning = result.auditWarning;
              }
              if (auditWarning) toast.warning(auditWarning);
              else toast.success("Players moved.");
              setBusy(false);
              setSelected([]);
              router.refresh();
            })();
          }}
        >
          <select value={parentId} onChange={(event) => setParentId(event.target.value)} aria-label="Move selected players to" className="h-9 rounded-md border border-white/10 bg-[#0b1224] px-2 text-sm text-white">
            {parents.map((parent) => (
              <option key={parent.id} value={parent.id}>{parent.name}</option>
            ))}
          </select>
          <Button type="submit" disabled={busy}>Move selected</Button>
          <p className="w-full text-sm text-[#9fb0d0]">This changes which store or sub-creator the selected players are assigned to. It does not change their wallets.</p>
        </form>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#10182e]/80">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-transparent">
              {canMove ? <TableHead /> : null}
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Sub-creator</TableHead>
              <TableHead>Store</TableHead>
              <TableHead>Wallet</TableHead>
              <TableHead>Cash-out</TableHead>
              <TableHead>Coins</TableHead>
              <TableHead>Level</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Status</TableHead>
              {showIp ? <TableHead>IP</TableHead> : null}
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={(canMove ? 13 : 12) + (showIp ? 1 : 0)} className="py-4">
                  <AdminEmptyState title="No players in this view" body="Try another name, phone, email, or store filter." />
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  {canMove ? (
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selected.includes(row.id)}
                        onChange={(event) =>
                          setSelected((current) =>
                            event.target.checked ? [...current, row.id] : current.filter((id) => id !== row.id)
                          )
                        }
                        aria-label={`Select ${row.name}`}
                      />
                    </TableCell>
                  ) : null}
                  <TableCell className="font-semibold text-white">{row.name}</TableCell>
                  <TableCell>{row.phone}</TableCell>
                  <TableCell>{row.email}</TableCell>
                  <TableCell>{row.subCreator}</TableCell>
                  <TableCell>{row.store}</TableCell>
                  <TableCell>${row.wallet.toFixed(2)}</TableCell>
                  <TableCell>${row.cashout.toFixed(2)}</TableCell>
                  <TableCell>{row.coins}</TableCell>
                  <TableCell>{row.level ?? "—"}</TableCell>
                  <TableCell>{row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "—"}</TableCell>
                  <TableCell><AdminStatusBadge status={row.status} /></TableCell>
                  {showIp ? (
                    <TableCell className="text-xs">
                      {row.signupIp === "—" && row.lastSeenIp === "—" ? (
                        "—"
                      ) : (
                        <span className="block">
                          <span className="block">Signup {row.signupIp ?? "—"}</span>
                          <span className="block">Last seen {row.lastSeenIp ?? "—"}</span>
                        </span>
                      )}
                    </TableCell>
                  ) : null}
                  <TableCell>
                    <Button size="sm" variant="outline" className="border-white/15 bg-transparent text-white" asChild>
                      <Link href={`/admin/users/${row.id}`}>Open profile</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
