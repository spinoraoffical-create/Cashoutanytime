import type { Metadata } from "next";
import { Check } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminErrorState } from "@/components/admin/ui/admin-error-state";
import { AdminSectionCard } from "@/components/admin/ui/admin-section-card";
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

  const loadError = rolesRes.error || permsRes.error || rolePermsRes.error || memberCountsRes.error;
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
        title="Staff roles"
        description="Read only. Super Admin already has every permission. A role is assigned from a player's profile, and this page does not change who has a role."
      />

      {loadError ? (
        <AdminErrorState title="Staff roles could not be loaded" body="The permission list is unchanged. Try this page again in a moment." />
      ) : (
      <>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {roles.map((role) => (
          <AdminSectionCard key={role.id} title={role.name} description={role.description ?? "No description is stored for this role."}>
            <p className="text-sm tabular-nums text-[#9fb0d0]">
              {(memberCounts.get(role.id) ?? 0).toLocaleString()}{" "}
              {(memberCounts.get(role.id) ?? 0) === 1 ? "person" : "people"} with this role
            </p>
          </AdminSectionCard>
        ))}
      </div>

      <AdminSectionCard
        title="Permission summary"
        description="A check means that role already has the permission. This table does not grant or remove a permission."
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="sticky left-0 bg-[#12162e] text-[#8ea0c3]">Permission</TableHead>
                {roles.map((r) => (
                  <TableHead key={r.id} className="text-center text-xs capitalize text-[#8ea0c3]">
                    {r.name.replace(" Admin", "")}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {permissions.map((perm) => (
                <TableRow key={perm.id} className="border-white/5 hover:bg-white/[0.03]">
                  <TableCell className="sticky left-0 bg-[#12162e]">
                    <p className="text-sm font-medium text-white">{perm.name}</p>
                    <p className="font-mono text-xs text-[#8ea0c3]">{perm.key}</p>
                  </TableCell>
                  {roles.map((role) => (
                    <TableCell key={role.id} className="text-center">
                      {hasPerm(role.id, perm.id, role.key) ? (
                        <Check className="mx-auto size-4 text-emerald-300" aria-label="granted" />
                      ) : (
                        <span className="text-[#8ea0c3]" aria-label="not granted">
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
      </AdminSectionCard>
      </>
      )}
    </div>
  );
}
