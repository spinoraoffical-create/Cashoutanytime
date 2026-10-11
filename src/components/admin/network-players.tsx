"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { movePlayerAction, type NetworkPlayer } from "@/lib/actions/agents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function NetworkPlayers({
  rows,
  parents,
  canMove,
  showParentFilter,
  query,
}: {
  rows: NetworkPlayer[];
  parents: { id: string; name: string }[];
  canMove: boolean;
  showParentFilter: boolean;
  query: { q?: string; parent?: string };
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [parentId, setParentId] = useState(parents[0]?.id ?? "");
  const [busy, setBusy] = useState(false);

  return (
    <div className="space-y-4">
      <form className="flex flex-wrap gap-2" action="/admin/players">
        <Input name="q" defaultValue={query.q} placeholder="Search name, phone, email, sub-creator, or store" className="max-w-md" />
        {showParentFilter ? (
          <select name="parent" defaultValue={query.parent ?? "all"} className="h-9 rounded-md border border-border bg-background px-2 text-sm">
            <option value="all">All parents</option>
            {parents.map((parent) => (
              <option key={parent.id} value={parent.id}>{parent.name}</option>
            ))}
          </select>
        ) : null}
        <Button type="submit" variant="outline">Filter</Button>
        <Button variant="outline" asChild>
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
              for (const id of selected) {
                const result = await movePlayerAction(id, parentId);
                if (!result.ok) {
                  toast.error(result.error ?? "Could not move a player.");
                  setBusy(false);
                  return;
                }
              }
              toast.success("Players moved.");
              setBusy(false);
              setSelected([]);
              router.refresh();
            })();
          }}
        >
          <select value={parentId} onChange={(event) => setParentId(event.target.value)} className="h-9 rounded-md border border-border bg-background px-2 text-sm">
            {parents.map((parent) => (
              <option key={parent.id} value={parent.id}>{parent.name}</option>
            ))}
          </select>
          <Button type="submit" disabled={busy}>Move selected</Button>
        </form>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
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
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canMove ? 13 : 12} className="py-8 text-center text-muted-foreground">
                  No players in this view.
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
                  <TableCell className="font-semibold">{row.name}</TableCell>
                  <TableCell>{row.phone}</TableCell>
                  <TableCell>{row.email}</TableCell>
                  <TableCell>{row.subCreator}</TableCell>
                  <TableCell>{row.store}</TableCell>
                  <TableCell>${row.wallet.toFixed(2)}</TableCell>
                  <TableCell>${row.cashout.toFixed(2)}</TableCell>
                  <TableCell>{row.coins}</TableCell>
                  <TableCell>{row.level ?? "—"}</TableCell>
                  <TableCell>{row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "—"}</TableCell>
                  <TableCell>{row.status}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/admin/users/${row.id}`}>Open</Link>
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
