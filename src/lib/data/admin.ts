import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AppRole, Permission } from "@/lib/database.types";

export type StaffContext = {
  userId: string;
  email: string | null;
  roles: AppRole[];
  permissions: Set<string>;
  isSuperAdmin: boolean;
};

/**
 * Resolve the signed-in user's staff context (roles + permissions).
 * Returns null for non-staff. Single source of truth for admin access.
 * Wrapped in React `cache()` so the admin layout and every admin page's
 * requirePermission() share one resolution per request instead of each
 * re-running the auth + two role/permission queries from scratch.
 */
const STAFF_ROLES: AppRole[] = [
  "super_admin",
  "admin",
  "manager",
  "support_agent",
  "moderator",
];

async function legacyAdminContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  email: string | null
): Promise<StaffContext | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  // Legacy profiles.role only. A missing row must not grant staff access.
  const isAdminRole = profile?.role === "admin" || profile?.role === "super_admin";

  if (!isAdminRole) return null;

  return {
    userId,
    email,
    roles: ["super_admin"],
    permissions: new Set<string>(),
    isSuperAdmin: true,
  };
}

export const getStaffContext = cache(async (): Promise<StaffContext | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: roleRows, error: roleError } = await supabase
    .from("user_roles")
    .select("roles(key, role_permissions(permissions(key)))")
    .eq("user_id", user.id);

  const roles =
    roleError
      ? []
      : ((roleRows ?? [])
          .map((r) => (r.roles as unknown as { key: AppRole } | null)?.key)
          .filter((k): k is AppRole => Boolean(k)) ?? []);

  const isStaff = roles.some((r) => STAFF_ROLES.includes(r));
  if (!isStaff) {
    return legacyAdminContext(supabase, user.id, user.email ?? null);
  }

  const isSuperAdmin = roles.includes("super_admin");

  const permissions = new Set<string>();
  for (const row of roleRows ?? []) {
    const role = row.roles as unknown as {
      key?: AppRole;
      role_permissions?: { permissions?: { key: string } | null }[];
    } | null;
    for (const rp of role?.role_permissions ?? []) {
      if (rp.permissions?.key) permissions.add(rp.permissions.key);
    }
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    roles,
    permissions,
    isSuperAdmin,
  };
});

/**
 * Same shape as getStaffContext(), but for a known user id via the service-role
 * client instead of a cookie session — for callers with no session, like the
 * Telegram admin bot webhook (Telegram identity is resolved to a user id via
 * telegram_links first). Kept separate deliberately: the two functions have
 * genuinely different auth sources and shouldn't be merged into one that
 * branches on session-vs-service-role internally.
 */
export async function getStaffContextForUserId(userId: string): Promise<StaffContext | null> {
  const supabase = createAdminClient();
  if (!supabase) return null;

  const { data: authUser } = await supabase.auth.admin.getUserById(userId);

  const { data: roleRows, error: roleError } = await supabase
    .from("user_roles")
    .select("roles(key)")
    .eq("user_id", userId);

  const roles =
    roleError
      ? []
      : ((roleRows ?? [])
          .map((r) => (r.roles as unknown as { key: AppRole } | null)?.key)
          .filter((k): k is AppRole => Boolean(k)) ?? []);

  const isStaff = roles.some((r) => STAFF_ROLES.includes(r));
  if (!isStaff) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    if (profile?.role !== "admin") return null;
    return {
      userId,
      email: authUser?.user?.email ?? null,
      roles: ["super_admin"],
      permissions: new Set<string>(),
      isSuperAdmin: true,
    };
  }

  const isSuperAdmin = roles.includes("super_admin");

  const { data: permRows } = await supabase
    .from("user_roles")
    .select("roles(role_permissions(permissions(key)))")
    .eq("user_id", userId);

  const permissions = new Set<string>();
  for (const row of permRows ?? []) {
    const role = row.roles as unknown as {
      role_permissions?: { permissions?: { key: string } | null }[];
    } | null;
    for (const rp of role?.role_permissions ?? []) {
      if (rp.permissions?.key) permissions.add(rp.permissions.key);
    }
  }

  return {
    userId,
    email: authUser?.user?.email ?? null,
    roles,
    permissions,
    isSuperAdmin,
  };
}

/** Guard: redirect non-staff away from the admin area. */
export async function requireStaff(): Promise<StaffContext> {
  const ctx = await getStaffContext();
  if (!ctx) redirect("/dashboard");
  return ctx;
}

export function can(ctx: StaffContext, permission: string): boolean {
  return ctx.isSuperAdmin || ctx.permissions.has(permission);
}

/** Guard a module by permission; super_admin always passes. */
export async function requirePermission(permission: string): Promise<StaffContext> {
  const ctx = await requireStaff();
  if (!can(ctx, permission)) redirect("/admin");
  return ctx;
}

/** Fraud flags and audit logs. Super Admin only. */
export async function requireSuperAdmin(): Promise<StaffContext> {
  const ctx = await requireStaff();
  if (!ctx.isSuperAdmin) redirect("/admin");
  return ctx;
}

/**
 * Primary admin sections. The sidebar reads `visibleAdminNav()` in
 * `@/lib/admin/nav`, which also hides tools by role.
 */
export const ADMIN_MODULES = [
  { href: "/admin", label: "Dashboard", icon: "LayoutDashboard", permission: null, group: "Main" },
  { href: "/admin/money", label: "Money Center", icon: "Wallet", permission: "requests.manage", group: "Main" },
  { href: "/admin/users", label: "Players", icon: "Users", permission: "users.manage", group: "Main" },
  { href: "/admin/support", label: "Support", icon: "LifeBuoy", permission: "support.manage", group: "Main" },
  { href: "/admin/growth", label: "Growth", icon: "Gift", permission: "promotions.manage", group: "Main" },
  { href: "/admin/content", label: "Content", icon: "FileText", permission: "cms.manage", group: "Main" },
  { href: "/admin/automation", label: "Automation", icon: "Bot", permission: "cms.manage", group: "Main" },
  { href: "/admin/settings", label: "Settings", icon: "Settings", permission: "settings.manage", group: "Main" },
  { href: "/admin/security", label: "Security", icon: "ShieldAlert", permission: "audit.read", group: "Main" },
] as const;

export type PermissionRow = Permission;
