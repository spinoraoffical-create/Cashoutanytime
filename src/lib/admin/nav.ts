/** Admin navigation. Imported by the server layout gate. No server-only imports. */

export type AdminNavChild = {
  href: string;
  label: string;
  permission: string | null;
  superOnly?: boolean;
  /** Visible when the staff member has any of these roles, in addition to permission. */
  roleAny?: string[];
};

export type AdminNavSection = {
  href: string;
  label: string;
  icon: string;
  /** Visible when the staff member has this permission. Null means any staff, unless other gates apply. */
  permission: string | null;
  roleAny?: string[];
  /** Visible when the staff member has any of these permissions. */
  anyPermissions?: string[];
  superOnly?: boolean;
  /** Hidden from support agents and moderators. */
  operatorOnly?: boolean;
  children: AdminNavChild[];
};

export type StaffNavAccess = {
  isSuperAdmin: boolean;
  permissions: Set<string> | readonly string[];
  roles: readonly string[];
};

export const ADMIN_NAV: AdminNavSection[] = [
  {
    href: "/admin",
    label: "Dashboard",
    icon: "LayoutDashboard",
    permission: null,
    children: [],
  },
  {
    href: "/admin/money",
    label: "Money Center",
    icon: "Wallet",
    permission: null,
    anyPermissions: ["requests.manage"],
    children: [
      {
        href: "/admin/deposits",
        label: "Incoming Deposits",
        permission: "requests.manage",
        roleAny: ["store_creator", "sub_creator"],
      },
      { href: "/admin/game-loads", label: "Wallet Loads & Redeems", permission: "requests.manage" },
      { href: "/admin/payouts", label: "Cash-out / Payouts", permission: "requests.manage" },
      { href: "/admin/transactions", label: "Transaction History", permission: "requests.manage" },
      { href: "/admin/requests", label: "Deposit records", permission: "requests.manage" },
      {
        href: "/admin/failed-loads",
        label: "Failed loads",
        permission: "requests.manage",
        roleAny: ["store_creator", "sub_creator"],
      },
      { href: "/admin/cashout-holds", label: "Held cash outs", permission: "requests.manage" },
    ],
  },
  {
    href: "/admin/users",
    label: "Players",
    icon: "Users",
    permission: null,
    anyPermissions: ["users.manage", "cms.manage"],
    children: [
      { href: "/admin/users", label: "All players", permission: "users.manage" },
      {
        href: "/admin/players",
        label: "Network players",
        permission: "users.manage",
        roleAny: ["store_creator", "sub_creator"],
      },
      {
        href: "/admin/sub-creators",
        label: "Sub-creators",
        permission: "users.manage",
        roleAny: ["store_creator"],
      },
      {
        href: "/admin/agent-inbox",
        label: "Player chat",
        permission: null,
        roleAny: ["sub_creator"],
      },
      { href: "/admin/kyc", label: "Identity review", permission: "cms.manage" },
      { href: "/admin/crm", label: "CRM", permission: "users.manage" },
    ],
  },
  {
    href: "/admin/support",
    label: "Support",
    icon: "LifeBuoy",
    permission: "support.manage",
    roleAny: ["store_creator"],
    children: [
      { href: "/admin/support", label: "Tickets", permission: "support.manage", roleAny: ["store_creator"] },
      { href: "/admin/chat", label: "Live chat", permission: "support.manage" },
    ],
  },
  {
    href: "/admin/growth",
    label: "Growth",
    icon: "Gift",
    permission: null,
    anyPermissions: [
      "promotions.manage",
      "referrals.manage",
      "vip.manage",
      "rewards.manage",
      "achievements.manage",
      "leaderboards.manage",
    ],
    children: [
      { href: "/admin/promotions", label: "Promotions", permission: "promotions.manage" },
      {
        href: "/admin/offers",
        label: "Offers",
        permission: null,
        roleAny: ["super_admin", "store_creator", "sub_creator"],
      },
      { href: "/admin/referrals", label: "Referrals", permission: "referrals.manage" },
      { href: "/admin/vip", label: "VIP tiers", permission: "vip.manage" },
      { href: "/admin/rewards", label: "Rewards", permission: "rewards.manage" },
      { href: "/admin/achievements", label: "Achievements", permission: "achievements.manage" },
      { href: "/admin/leaderboards", label: "Leaderboards", permission: "leaderboards.manage" },
      { href: "/admin/bonus-transactions", label: "Bonus history", permission: "rewards.manage" },
    ],
  },
  {
    href: "/admin/content",
    label: "Content",
    icon: "FileText",
    permission: null,
    anyPermissions: ["cms.manage", "notifications.broadcast", "newsletters.manage"],
    children: [
      { href: "/admin/cms", label: "CMS", permission: "cms.manage" },
      { href: "/admin/games", label: "Games", permission: "cms.manage" },
      { href: "/admin/notifications", label: "Broadcasts", permission: "notifications.broadcast" },
      { href: "/admin/newsletters", label: "Newsletters", permission: "newsletters.manage" },
      { href: "/admin/reviews", label: "Reviews", permission: "cms.manage" },
      { href: "/admin/marketing", label: "Phone outreach", permission: "cms.manage" },
      { href: "/admin/geo", label: "Location pages", permission: "cms.manage" },
    ],
  },
  {
    href: "/admin/automation",
    label: "Automation",
    icon: "Bot",
    permission: null,
    anyPermissions: ["cms.manage", "support.manage"],
    operatorOnly: true,
    children: [
      { href: "/admin/ai-blog", label: "AI blog", permission: "cms.manage" },
      { href: "/admin/telegram", label: "Telegram", permission: "cms.manage" },
      { href: "/admin/ai-bot", label: "AI chatbot", permission: "support.manage" },
    ],
  },
  {
    href: "/admin/settings",
    label: "Settings",
    icon: "Settings",
    permission: null,
    anyPermissions: ["settings.manage", "users.roles", "cms.manage"],
    children: [
      { href: "/admin/settings", label: "Site settings", permission: "settings.manage" },
      { href: "/admin/payments", label: "Payment methods", permission: "cms.manage" },
      { href: "/admin/roles", label: "Roles & permissions", permission: "users.roles" },
    ],
  },
  {
    href: "/admin/security",
    label: "Security",
    icon: "ShieldAlert",
    permission: null,
    superOnly: true,
    children: [
      { href: "/admin/fraud", label: "Fraud flags", permission: null, superOnly: true },
      { href: "/admin/audit", label: "Audit logs", permission: null, superOnly: true },
    ],
  },
];

function permissionSet(access: StaffNavAccess) {
  return access.permissions instanceof Set ? access.permissions : new Set(access.permissions);
}

function isOperator(access: StaffNavAccess) {
  return (
    access.isSuperAdmin ||
    access.roles.some((role) => role === "super_admin" || role === "admin" || role === "manager")
  );
}

export function canSeeNavItem(
  access: StaffNavAccess,
  item: { permission: string | null; superOnly?: boolean; roleAny?: string[] }
) {
  if (item.superOnly && !access.isSuperAdmin) return false;
  const byPerm = item.permission
    ? access.isSuperAdmin || permissionSet(access).has(item.permission)
    : false;
  const byRole = (item.roleAny ?? []).some(
    (role) => access.roles.includes(role) || (role === "super_admin" && access.isSuperAdmin)
  );
  if (item.roleAny?.length && item.permission) return byPerm || byRole;
  if (item.roleAny?.length) return byRole;
  if (!item.permission) return true;
  return byPerm;
}

const HUB_HREFS = new Set([
  "/admin",
  "/admin/money",
  "/admin/growth",
  "/admin/content",
  "/admin/automation",
  "/admin/security",
  "/admin/support",
]);

export function visibleAdminNav(access: StaffNavAccess): AdminNavSection[] {
  const sections: AdminNavSection[] = [];

  for (const section of ADMIN_NAV) {
    if (section.superOnly && !access.isSuperAdmin) continue;
    if (section.operatorOnly && !isOperator(access)) continue;

    const children = section.children.filter((child) => canSeeNavItem(access, child));
    const listed =
      !section.anyPermissions ||
      access.isSuperAdmin ||
      section.anyPermissions.some((key) => permissionSet(access).has(key)) ||
      children.length > 0;
    if (!listed || !canSeeNavItem(access, section)) continue;
    if (section.children.length > 0 && children.length === 0) continue;

    const href =
      HUB_HREFS.has(section.href) || children.some((child) => child.href === section.href)
        ? section.href
        : (children[0]?.href ?? section.href);

    sections.push({ ...section, href, children });
  }

  return sections.slice(0, 10);
}
