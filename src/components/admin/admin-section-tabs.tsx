"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { AdminNavItem } from "@/components/admin/admin-sidebar";
import { cn } from "@/lib/utils";

function isCurrent(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminSectionTabs({
  items,
  badges = {},
}: {
  items: AdminNavItem[];
  badges?: Record<string, number>;
}) {
  const pathname = usePathname();
  const section = items.find(
    (item) =>
      isCurrent(pathname, item.href) ||
      (item.children ?? []).some((child) => isCurrent(pathname, child.href))
  );
  const tabs = section?.children ?? [];
  if (tabs.length < 2) return null;

  return (
    <div className="mb-5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {tabs.map((tab) => {
        const active = isCurrent(pathname, tab.href);
        return (
          <Link
            key={tab.href + tab.label}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-sm font-semibold",
              active
                ? "border-transparent bg-foreground text-background"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            {badges[tab.href] ? (
              <span className={cn("text-xs", active ? "text-background/80" : "text-[#f3264f]")}>
                {badges[tab.href]}
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
