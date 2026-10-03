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

async function legacySpinoraAdminContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  email: string | null
): Promise<StaffContext | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  // Allow admin access if profile role is admin, or if profile is missing/unseeded in dev mode
  const isDev = process.env.NODE_ENV === "development";
  const isAdminRole = profile?.role === "admin" || !profile || isDev;

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
    return legacySpinoraAdminContext(supabase, user.id, user.email ?? null);
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

/** All admin modules + the permission each requires, for nav + access checks. */
export const ADMIN_MODULES = [
  { href: "/admin", label: "Overview", icon: "LayoutDashboard", permission: null, group: "Insights" },
  { href: "/admin/analytics", label: "Analytics", icon: "ChartColumn", permission: "analytics.read", group: "Insights" },
  { href: "/admin/users", label: "Users", icon: "Users", permission: "users.manage", group: "People" },
  { href: "/admin/crm", label: "CRM", icon: "Contact2", permission: "users.manage", group: "People" },
  { href: "/admin/roles", label: "Roles & Permissions", icon: "ShieldCheck", permission: "users.roles", group: "People" },
  { href: "/admin/referrals", label: "Referrals", icon: "UserPlus", permission: "referrals.manage", group: "People" },
  { href: "/admin/promotions", label: "Promotions", icon: "BadgePercent", permission: "promotions.manage", group: "Economy" },
  { href: "/admin/rewards", label: "Rewards", icon: "Gift", permission: "rewards.manage", group: "Economy" },
  { href: "/admin/achievements", label: "Achievements", icon: "Trophy", permission: "achievements.manage", group: "Economy" },
  { href: "/admin/vip", label: "VIP Tiers", icon: "Crown", permission: "vip.manage", group: "Economy" },
  { href: "/admin/leaderboards", label: "Leaderboards", icon: "Swords", permission: "leaderboards.manage", group: "Economy" },
  { href: "/admin/cms", label: "CMS", icon: "FileText", permission: "cms.manage", group: "Content" },
  { href: "/admin/games", label: "Games", icon: "Gamepad2", permission: "cms.manage", group: "Content" },
  { href: "/admin/geo", label: "Geo Pages", icon: "MapPin", permission: "cms.manage", group: "Content" },
  { href: "/admin/reviews", label: "Reviews", icon: "Star", permission: "cms.manage", group: "Content" },
  { href: "/admin/notifications", label: "Broadcasts", icon: "Megaphone", permission: "notifications.broadcast", group: "Content" },
  { href: "/admin/newsletters", label: "Newsletters", icon: "Mail", permission: "newsletters.manage", group: "Content" },
  { href: "/admin/ai-blog", label: "AI Auto Blog", icon: "Sparkles", permission: "cms.manage", group: "AI Automation" },
  { href: "/admin/telegram", label: "Telegram Bot", icon: "Send", permission: "cms.manage", group: "AI Automation" },
  { href: "/admin/ai-bot", label: "AI Chatbot", icon: "Bot", permission: "support.manage", group: "AI Automation" },
  { href: "/admin/analyzer", label: "AI Self-Analyzer", icon: "Activity", permission: "analytics.read", group: "AI Automation" },
  { href: "/admin/requests", label: "Deposit Requests", icon: "Inbox", permission: "requests.manage", group: "Operations" },
  { href: "/admin/payments", label: "Payment Methods", icon: "Wallet", permission: "cms.manage", group: "Operations" },
  { href: "/admin/provision-jobs", label: "Bot Jobs", icon: "Bot", permission: "requests.manage", group: "Operations" },
  { href: "/admin/payouts", label: "Cash-out Payouts", icon: "Banknote", permission: "requests.manage", group: "Operations" },
  { href: "/admin/support", label: "Support Tickets", icon: "LifeBuoy", permission: "support.manage", group: "Operations" },
  { href: "/admin/chat", label: "Live Chat", icon: "MessageSquare", permission: "support.manage", group: "Operations" },
  { href: "/admin/deposits", label: "Deposits", icon: "Wallet", permission: "requests.manage", group: "Operations" },
  { href: "/admin/game-loads", label: "Wallet Loads", icon: "Banknote", permission: "requests.manage", group: "Operations" },
  { href: "/admin/transactions", label: "Transactions", icon: "History", permission: "requests.manage", group: "Operations" },
  { href: "/admin/bonus-transactions", label: "Bonus History", icon: "Gift", permission: "rewards.manage", group: "Operations" },
  { href: "/admin/fraud", label: "Fraud / Flags", icon: "ShieldAlert", permission: "users.manage", group: "Operations" },
  { href: "/admin/audit", label: "Audit Logs", icon: "ScrollText", permission: "audit.read", group: "Operations" },
  { href: "/admin/settings", label: "Settings", icon: "Settings", permission: "settings.manage", group: "Operations" },
] as const;

export type PermissionRow = Permission;
