import { AdminChrome } from "@/components/admin/admin-chrome";
import { visibleAdminNav } from "@/lib/admin/nav";
import { requireStaff } from "@/lib/data/admin";

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  manager: "Manager",
  support_agent: "Support Agent",
  moderator: "Moderator",
};

export async function AdminLayoutGate({ children }: { children: React.ReactNode }) {
  const ctx = await requireStaff();
  const sections = visibleAdminNav({
    isSuperAdmin: ctx.isSuperAdmin,
    permissions: ctx.permissions,
    roles: ctx.roles,
  });

  const items = sections.map((section) => ({
    href: section.href,
    label: section.label,
    icon: section.icon,
    children: section.children.map((child) => ({ href: child.href, label: child.label })),
  }));

  const topRole =
    ROLE_LABEL[
      ["super_admin", "admin", "manager", "support_agent", "moderator"].find((role) =>
        ctx.roles.includes(role as never)
      ) ?? "moderator"
    ] ?? "Staff";

  return (
    <AdminChrome items={items} email={ctx.email} topRole={topRole} loadBadges>
      {children}
    </AdminChrome>
  );
}
