import { AdminChrome } from "@/components/admin/admin-chrome";
import { ADMIN_MODULES, can, requireStaff } from "@/lib/data/admin";

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  manager: "Manager",
  support_agent: "Support Agent",
  moderator: "Moderator",
};

export async function AdminLayoutGate({ children }: { children: React.ReactNode }) {
  const ctx = await requireStaff();

  const items = ADMIN_MODULES.filter(
    (m) => m.permission === null || can(ctx, m.permission)
  ).map((m) => ({
    href: m.href,
    label: m.label,
    icon: m.icon,
    group: m.group,
  }));

  const topRole =
    ROLE_LABEL[
      ["super_admin", "admin", "manager", "support_agent", "moderator"].find(
        (r) => ctx.roles.includes(r as never)
      ) ?? "moderator"
    ] ?? "Staff";

  return (
    <AdminChrome
      items={items}
      email={ctx.email}
      topRole={topRole}
      loadBadges={can(ctx, "requests.manage")}
    >
      {children}
    </AdminChrome>
  );
}
