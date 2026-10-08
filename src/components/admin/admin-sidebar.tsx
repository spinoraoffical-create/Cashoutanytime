"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ChevronDown, LogOut } from "lucide-react";

import { AdminIcon } from "@/components/admin/admin-icon";
import { logoutAction } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";

export type AdminNavChild = {
  href: string;
  label: string;
};

export type AdminNavItem = {
  href: string;
  label: string;
  icon: string;
  children?: AdminNavChild[];
};

function isCurrent(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function sectionActive(pathname: string, item: AdminNavItem) {
  if (isCurrent(pathname, item.href)) return true;
  return (item.children ?? []).some((child) => isCurrent(pathname, child.href));
}

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

  return (
    <div className="flex h-full flex-col">
      <nav aria-label="Admin" className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {items.map((item) => {
          const active = sectionActive(pathname, item);
          const kids = item.children ?? [];
          const badge =
            badges[item.href] ||
            kids.reduce((sum, child) => sum + (badges[child.href] ?? 0), 0);
          return (
            <div key={item.label}>
              <Link
                href={item.href}
                prefetch
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors",
                  active
                    ? "bg-ws-green/15 text-ws-green-deep dark:text-ws-green"
                    : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                )}
              >
                <AdminIcon name={item.icon} className="size-4.5 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {badge > 0 ? (
                  <span className="flex min-w-5 items-center justify-center rounded-full bg-[#f3264f] px-1.5 text-[11px] font-bold leading-5 text-white">
                    {badge > 99 ? "99+" : badge}
                  </span>
                ) : null}
                {kids.length > 0 ? (
                  <ChevronDown
                    className={cn("size-4 shrink-0 transition-transform", active ? "rotate-180" : "")}
                    aria-hidden
                  />
                ) : null}
              </Link>
              {active && kids.length > 0 ? (
                <ul className="mb-2 mt-1 space-y-0.5 pl-4">
                  {kids.map((child) => {
                    const childActive = isCurrent(pathname, child.href);
                    return (
                      <li key={child.href + child.label}>
                        <Link
                          href={child.href}
                          prefetch
                          onClick={onNavigate}
                          aria-current={childActive ? "page" : undefined}
                          className={cn(
                            "flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm",
                            childActive
                              ? "font-semibold text-foreground"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <span className="flex-1">{child.label}</span>
                          {badges[child.href] ? (
                            <span className="text-xs font-bold text-[#f3264f]">{badges[child.href]}</span>
                          ) : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          );
        })}
      </nav>

      <div className="space-y-1 border-t border-border p-3">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
        >
          <ArrowLeft className="size-4.5" aria-hidden />
          Exit to player app
        </Link>
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex min-h-10 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="size-4.5" aria-hidden />
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
