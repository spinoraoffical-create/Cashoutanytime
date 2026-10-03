import type { Metadata } from "next";
import { Check } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { GlassCard } from "@/components/shared/glass-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminDb } from "@/lib/actions/admin/core";
import { requirePermission } from "@/lib/data/admin";

export const metadata: Metadata = { title: "Roles & Permissions" };

export default async function AdminRolesPage() {
  await requirePermission("users.roles");
  const db = adminDb();

  const [rolesRes, permsRes, rolePermsRes, memberCountsRes] = await Promise.all([
    db.from("roles").select("id, key, name, description").order("key"),
    db.from("permissions").select("id, key, name, module").order("module"),
    db.from("role_permissions").select("role_id, permission_id"),
    db.from("user_roles").select("role_id"),
  ]);

  const roles = rolesRes.data ?? [];
  const permissions = permsRes.data ?? [];
  const rolePerms = new Set(
    (rolePermsRes.data ?? []).map((rp) => `${rp.role_id}:${rp.permission_id}`)
  );
  const memberCounts = new Map<string, number>();
  for (const ur of memberCountsRes.data ?? []) {
    memberCounts.set(ur.role_id, (memberCounts.get(ur.role_id) ?? 0) + 1);
  }

  const hasPerm = (roleId: string, permId: string, roleKey: string) =>
    roleKey === "super_admin" || rolePerms.has(`${roleId}:${permId}`);

  return (
    <div className="mx-auto max-w-6xl">
      <AdminPageHeader
        title="Roles & Permissions"
        description="The RBAC matrix. Super Admin implicitly holds every permission. Assign roles from a member's profile."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {roles.map((role) => (
          <GlassCard key={role.id} className="p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-bold capitalize">{role.name}</h3>
              <span className="tnum text-xs text-muted-foreground">
                {(memberCounts.get(role.id) ?? 0).toLocaleString()} members
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{role.description}</p>
          </GlassCard>
        ))}
      </div>

      <GlassCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-foreground/8 hover:bg-transparent">
                <TableHead className="sticky left-0">Permission</TableHead>
                {roles.map((r) => (
                  <TableHead key={r.id} className="text-center text-xs capitalize">
                    {r.name.replace(" Admin", "")}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {permissions.map((perm) => (
                <TableRow key={perm.id} className="border-foreground/8">
                  <TableCell>
                    <p className="text-sm font-medium">{perm.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {perm.key}
                    </p>
                  </TableCell>
                  {roles.map((role) => (
                    <TableCell key={role.id} className="text-center">
                      {hasPerm(role.id, perm.id, role.key) ? (
                        <Check
                          className="mx-auto size-4 text-ws-emerald"
                          aria-label="granted"
                        />
                      ) : (
                        <span className="text-ws-text-faint" aria-label="not granted">
                          —
                        </span>
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </GlassCard>
    </div>
  );
}
