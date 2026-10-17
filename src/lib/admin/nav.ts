/** Admin navigation. Imported by the server layout gate. No server-only imports. */

export type AdminNavChild = {
  href: string;
  label: string;
  permission: string | null;
  superOnly?: boolean;
  /** Visible when the staff member has any of these roles, in addition to permission. */
  roleAny?: string[];
  /** Store and sub-creator menus never include this link. */
  hiddenFromStore?: boolean;
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
    href: "/admin/users",
    label: "Player CRM",
    icon: "Users",
    permission: null,
    anyPermissions: ["users.manage", "support.manage"],
    children: [
      { href: "/admin/users", label: "All players", permission: "users.manage" },
      {
        href: "/admin/players",
        label: "Network players",
        permission: "users.manage",
        roleAny: ["store_creator", "sub_creator"],
      },
      { href: "/admin/crm", label: "Player follow-up", permission: "users.manage" },
      { href: "/admin/support", label: "Tickets", permission: null, superOnly: true, hiddenFromStore: true },
      { href: "/admin/chat", label: "Live chat", permission: "support.manage", hiddenFromStore: true },
    ],
  },
  {
    href: "/admin/money",
    label: "Financial Center",
    icon: "Wallet",
    permission: null,
    anyPermissions: ["requests.manage"],
    children: [
      {
        href: "/admin/deposits",
        label: "Deposits",
        permission: "requests.manage",
        roleAny: ["store_creator", "sub_creator"],
      },
      { href: "/admin/game-loads", label: "Loads and redeems", permission: "requests.manage" },
      {
        href: "/admin/failed-loads",
        label: "Failed loads",
        permission: "requests.manage",
        roleAny: ["store_creator", "sub_creator"],
      },
      { href: "/admin/payouts", label: "Cash outs", permission: "requests.manage" },
      { href: "/admin/payout-operations", label: "Payout activity", permission: "requests.manage" },
      { href: "/admin/transactions", label: "All transactions", permission: "requests.manage" },
      { href: "/admin/cashout-holds", label: "Held cash outs", permission: "requests.manage" },
      {
        href: "/admin/requests",
        label: "Deposit records",
        permission: "requests.manage",
        roleAny: ["store_creator", "sub_creator"],
      },
    ],
  },
  {
    href: "/admin/game-accounts",
    label: "Game Center",
    icon: "Gamepad2",
    permission: null,
    anyPermissions: ["cms.manage", "requests.manage"],
    children: [
      { href: "/admin/games", label: "Games list", permission: "cms.manage" },
      {
        href: "/admin/game-accounts",
        label: "Game accounts",
        permission: "requests.manage",
        roleAny: ["store_creator", "sub_creator"],
      },
      {
        href: "/admin/failed-loads",
        label: "Failed loads",
        permission: "requests.manage",
        roleAny: ["store_creator", "sub_creator"],
      },
      { href: "/admin/game-balances", label: "Live game coins", permission: null, superOnly: true },
    ],
  },
  {
    href: "/admin/agents",
    label: "Store Center",
    icon: "UserPlus",
    permission: null,
    anyPermissions: ["users.manage"],
    children: [
      {
        href: "/admin/sub-creators",
        label: "Store and sub creators",
        permission: "users.manage",
        roleAny: ["store_creator"],
      },
      {
        href: "/admin/agent-inbox",
        label: "Player chat",
        permission: null,
        roleAny: ["super_admin", "store_creator", "sub_creator"],
      },
    ],
  },
  {
    href: "/admin/marketing-center",
    label: "Marketing Center",
    icon: "Megaphone",
    permission: null,
    anyPermissions: ["newsletters.manage", "cms.manage", "notifications.broadcast", "promotions.manage"],
    children: [
      { href: "/admin/newsletters", label: "Email campaigns", permission: "newsletters.manage" },
      { href: "/admin/marketing", label: "Text one player", permission: "cms.manage" },
      { href: "/admin/telegram", label: "Telegram channel", permission: "cms.manage" },
      { href: "/admin/notifications", label: "In-app notices", permission: "notifications.broadcast" },
      { href: "/admin/promotions", label: "Promotions", permission: "promotions.manage" },
      {
        href: "/admin/offers",
        label: "One-time offers",
        permission: null,
        roleAny: ["super_admin", "store_creator", "sub_creator"],
      },
    ],
  },
  {
    href: "/admin/automation",
    label: "Automation Center",
    icon: "Bot",
    permission: null,
    anyPermissions: ["cms.manage", "support.manage"],
    operatorOnly: true,
    children: [
      { href: "/admin/ai-blog", label: "AI blog", permission: "cms.manage" },
      { href: "/admin/ai-bot", label: "Support chatbot", permission: "support.manage" },
      { href: "/admin/analyzer", label: "Analyzer", permission: null },
      { href: "/admin/game-automation", label: "Game automation", permission: null, superOnly: true },
    ],
  },
  {
    href: "/admin/growth",
    label: "Rewards Center",
    icon: "Gift",
    permission: null,
    anyPermissions: ["promotions.manage", "referrals.manage", "vip.manage", "rewards.manage", "achievements.manage", "leaderboards.manage"],
    children: [
      {
        href: "/admin/growth",
        label: "Rewards hub",
        permission: "promotions.manage",
        roleAny: ["super_admin"],
      },
      { href: "/admin/referrals", label: "Referrals", permission: "referrals.manage" },
      { href: "/admin/vip", label: "VIP", permission: "vip.manage" },
      { href: "/admin/rewards", label: "Rewards", permission: "rewards.manage" },
      { href: "/admin/achievements", label: "Achievements", permission: "achievements.manage" },
      { href: "/admin/leaderboards", label: "Leaderboards", permission: "leaderboards.manage" },
      { href: "/admin/bonus-transactions", label: "Bonus history", permission: "rewards.manage" },
    ],
  },
  {
    href: "/admin/kyc",
    label: "Verification Center",
    icon: "ShieldCheck",
    permission: null,
    anyPermissions: ["kyc.manage"],
    children: [{ href: "/admin/kyc", label: "Identity check", permission: "kyc.manage" }],
  },
  {
    href: "/admin/security",
    label: "Security Center",
    icon: "ShieldAlert",
    permission: null,
    superOnly: true,
    children: [
      { href: "/admin/fraud", label: "Fraud", permission: null, superOnly: true },
      { href: "/admin/security", label: "Security", permission: null, superOnly: true },
      { href: "/admin/audit", label: "Audit log", permission: null, superOnly: true },
    ],
  },
  {
    href: "/admin/analytics",
    label: "Analytics Center",
    icon: "ChartColumn",
    permission: null,
    children: [
      { href: "/admin/analytics", label: "Reports home", permission: "analytics.read" },
      {
        href: "/admin/player-transactions",
        label: "Player transactions",
        permission: null,
        roleAny: ["super_admin", "store_creator", "sub_creator"],
      },
      {
        href: "/admin/agent-reports",
        label: "Agent reports",
        permission: null,
        roleAny: ["super_admin", "store_creator", "sub_creator"],
      },
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
      { href: "/admin/roles", label: "Staff roles", permission: "users.roles" },
      { href: "/admin/cms", label: "Pages and FAQ", permission: "cms.manage" },
      { href: "/admin/reviews", label: "Reviews", permission: "cms.manage" },
      { href: "/admin/geo", label: "City pages", permission: "cms.manage" },
      { href: "/admin/content", label: "Website hub", permission: "cms.manage" },
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
  "/admin/agents",
  "/admin/game-accounts",
  "/admin/marketing-center",
  "/admin/automation",
  "/admin/settings",
  "/admin/support",
]);

export function visibleAdminNav(access: StaffNavAccess): AdminNavSection[] {
  const sections: AdminNavSection[] = [];

  for (const section of ADMIN_NAV) {
    if (section.superOnly && !access.isSuperAdmin) continue;
    if (section.operatorOnly && !isOperator(access)) continue;
    if (
      section.href === "/admin/support" &&
      (access.roles.includes("store_creator") || access.roles.includes("sub_creator"))
    ) {
      continue;
    }

    const storeScoped = access.roles.includes("store_creator") || access.roles.includes("sub_creator");
    const children = section.children.filter((child) => {
      if (child.hiddenFromStore && storeScoped) return false;
      return canSeeNavItem(access, child);
    });
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

  return sections;
}
