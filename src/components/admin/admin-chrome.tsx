"use client";

import * as React from "react";

import { AdminSidebar, type AdminNavItem } from "@/components/admin/admin-sidebar";
import { AdminTopbar } from "@/components/admin/admin-topbar";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/shared/logo";
import { getAdminSidebarBadgesAction } from "@/lib/actions/admin/badges";

export function AdminChrome({
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
    <div className="relative flex min-h-dvh text-foreground">
      <a
        href="#admin-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-lg focus:bg-ws-green focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-foreground"
      >
        Skip to content
      </a>

      <aside className="glass sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-y-0 border-l-0 lg:flex">
        <div className="flex items-center gap-2 border-b border-border px-5 py-4">
          <Logo size="sm" href="/admin" />
          <Badge className="bg-ws-green/15 text-ws-green-deep uppercase dark:text-ws-green">
            Admin
          </Badge>
        </div>
        <AdminSidebar items={items} badges={badges} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar items={items} email={email} topRole={topRole} badges={badges} />
        <main id="admin-content" className="flex-1 px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
