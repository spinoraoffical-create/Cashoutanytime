"use client";

import * as React from "react";

import { AdminBreadcrumbs } from "@/components/admin/admin-breadcrumbs";
import { AdminSectionTabs } from "@/components/admin/admin-section-tabs";
import { AdminSidebar, type AdminNavItem } from "@/components/admin/admin-sidebar";
import { AdminTopbar } from "@/components/admin/admin-topbar";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/shared/logo";
import { getAdminSidebarBadgesAction } from "@/lib/actions/admin/badges";

export function AdminShell({
  items,
  email,
  topRole,
  loadBadges,
  children,
}: {
  items: AdminNavItem[];
  email: string | null;
  topRole: string;
  loadBadges: boolean;
  children: React.ReactNode;
}) {
  const [badges, setBadges] = React.useState<Record<string, number>>({});

  React.useEffect(() => {
    if (!loadBadges) return;
    let cancelled = false;
    void getAdminSidebarBadgesAction().then((result) => {
      if (!cancelled && result.ok) setBadges(result.badges);
    });
    return () => {
      cancelled = true;
    };
  }, [loadBadges]);

  return (
    <div className="admin-v2 relative flex min-h-dvh bg-[#070b18] text-[#e8eefc]">
      <a
        href="#admin-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-lg focus:bg-ws-green focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-foreground"
      >
        Skip to content
      </a>

      <aside className="sticky top-0 hidden h-dvh w-72 shrink-0 flex-col border-r border-white/10 bg-[#0b1022] lg:flex">
        <div className="flex items-center gap-2 border-b border-white/10 px-5 py-4">
          <Logo size="sm" href="/admin" />
          <div className="min-w-0">
            <Badge className="border border-cyan-300/30 bg-cyan-400/10 text-cyan-100 uppercase">
              Control Center
            </Badge>
          </div>
        </div>
        <AdminSidebar items={items} badges={badges} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar items={items} email={email} topRole={topRole} badges={badges} />
        <main id="admin-content" className="flex-1 bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,0.16),transparent_45%),#070b18] px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-6 lg:px-8">
          <AdminBreadcrumbs items={items} />
          <AdminSectionTabs items={items} badges={badges} />
          {children}
        </main>
      </div>
    </div>
  );
}

export const AdminChrome = AdminShell;
