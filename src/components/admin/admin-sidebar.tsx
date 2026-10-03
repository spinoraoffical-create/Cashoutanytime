"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, LogOut } from "lucide-react";

import { AdminIcon } from "@/components/admin/admin-icon";
import { logoutAction } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: string;
  group: string;
};

export function AdminSidebar({
  items,
  onNavigate,
  badges = {},
}: {
  items: AdminNavItem[];
  onNavigate?: () => void;
  badges?: Record<string, number>;
}) {
  const pathname = usePathname();

  const groups = React.useMemo(() => {
    const map = new Map<string, AdminNavItem[]>();
    for (const item of items) {
      const arr = map.get(item.group) ?? [];
      arr.push(item);
      map.set(item.group, arr);
    }
    return [...map.entries()];
  }, [items]);

  return (
    <div className="flex h-full flex-col">
      <nav aria-label="Admin" className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {groups.map(([group, groupItems]) => (
          <div key={group}>
            <p className="hud-label px-3 pb-2 text-ws-text-faint">{group}</p>
            <ul className="space-y-0.5">
              {groupItems.map((item) => {
                const active =
                  item.href === "/admin"
                    ? pathname === "/admin"
                    : pathname.startsWith(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      prefetch
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                        active
                          ? "bg-ws-green/12 text-ws-green-deep dark:text-ws-green"
                          : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                      )}
                    >
                      <AdminIcon name={item.icon} className="size-4.5 shrink-0" />
                      <span className="flex-1">{item.label}</span>
                      {badges[item.href] ? (
                        <span className="ml-auto flex min-w-5 items-center justify-center rounded-full bg-ws-green px-1.5 text-[11px] font-bold leading-5 text-[#03190f]">
                          {badges[item.href] > 99 ? "99+" : badges[item.href]}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="space-y-1 border-t border-border p-3">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
        >
          <ArrowLeft className="size-4.5" aria-hidden />
          Exit to dashboard
        </Link>
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex min-h-10 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="size-4.5" aria-hidden />
            Sign Out
          </button>
        </form>
      </div>
    </div>
  );
}
