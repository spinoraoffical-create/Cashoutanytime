"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ChevronDown, LogOut, Search } from "lucide-react";

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

function sectionBadge(item: AdminNavItem, badges: Record<string, number>) {
  const seen = new Set<string>();
  let total = 0;
  for (const child of item.children ?? []) {
    if (seen.has(child.href)) continue;
    seen.add(child.href);
    total += badges[child.href] ?? 0;
  }
  if (!seen.has(item.href)) total += badges[item.href] ?? 0;
  return total;
}

export function AdminSidebar({
  items,
  onNavigate,
  badges = {},
  hints = {},
}: {
  items: AdminNavItem[];
  onNavigate?: () => void;
  badges?: Record<string, number>;
  hints?: Record<string, string>;
}) {
  const pathname = usePathname();
  const [query, setQuery] = React.useState("");
  const [openLabel, setOpenLabel] = React.useState<string | null>(null);
  const needle = query.trim().toLowerCase();
  const visible = items
    .map((item) => {
      const kids = (item.children ?? []).filter((child) => child.label.toLowerCase().includes(needle) || child.href.toLowerCase().includes(needle));
      const parentHit = item.label.toLowerCase().includes(needle);
      if (!needle) return item;
      if (parentHit) return item;
      if (kids.length === 0) return null;
      return { ...item, children: kids };
    })
    .filter((item): item is AdminNavItem => Boolean(item));

  return (
    <div className="flex h-full flex-col">
      <div className="px-3 pt-3">
        <label className="flex items-center gap-2 rounded-xl border border-[#7c3aed]/30 bg-[#0b1224] px-3 text-sm text-[#9fb0d0]">
          <Search className="size-4 shrink-0" aria-hidden />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search tools"
            aria-label="Search admin tools"
            className="h-10 w-full bg-transparent text-white outline-none placeholder:text-[#7f90b3]"
          />
        </label>
      </div>
      <nav aria-label="Admin" className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {visible.length === 0 ? (
          <p className="px-3 text-sm text-[#9fb0d0]">No tools match that search.</p>
        ) : null}
        {visible.map((item) => {
          const active = sectionActive(pathname, item);
          const kids = item.children ?? [];
          const expanded = Boolean(needle) || openLabel === item.label || (openLabel === null && active);
          const badge = sectionBadge(item, badges);
          return (
            <div key={item.label}>
              <div className="flex items-center gap-1">
                <Link
                  href={item.href}
                  prefetch
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  title={item.label}
                  className={cn(
                    "flex min-h-11 flex-1 items-center gap-3 rounded-xl px-3 text-sm font-semibold motion-safe:transition-colors",
                    active
                      ? "bg-gradient-to-r from-[#6d28d9] to-[#2563eb] text-white shadow-[0_0_18px_rgba(109,40,217,0.45)]"
                      : "text-[#c5d0e6] hover:bg-white/5 hover:text-white"
                  )}
                >
                  <AdminIcon name={item.icon} className="size-4.5 shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {badge > 0 ? (
                    <span
                      title={hints[item.href]}
                      className="flex min-w-5 items-center justify-center rounded-full bg-cyan-400/20 px-1.5 text-[11px] font-bold leading-5 text-cyan-100"
                    >
                      {badge > 99 ? "99+" : badge}
                    </span>
                  ) : null}
                </Link>
                {kids.length > 0 ? (
                  <button
                    type="button"
                    aria-label={expanded ? `Collapse ${item.label}` : `Expand ${item.label}`}
                    aria-expanded={expanded}
                    onClick={() => setOpenLabel(expanded && openLabel === item.label ? "" : item.label)}
                    className="flex size-9 items-center justify-center rounded-lg text-[#9fb0d0] hover:bg-white/5 hover:text-white"
                  >
                    <ChevronDown className={cn("size-4 motion-safe:transition-transform", expanded ? "rotate-180" : "")} aria-hidden />
                  </button>
                ) : null}
              </div>
              {expanded && kids.length > 0 ? (
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
                          title={child.label}
                          className={cn(
                            "flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm",
                            childActive ? "font-semibold text-cyan-200" : "text-[#9fb0d0] hover:text-white"
                          )}
                        >
                          <span className="flex-1">{child.label}</span>
                          {badges[child.href] ? (
                            <span title={hints[child.href]} className="text-xs font-bold text-cyan-200">
                              {badges[child.href]}
                            </span>
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

      <div className="space-y-1 border-t border-white/10 p-3">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-[#9fb0d0] hover:bg-white/5 hover:text-white"
        >
          <ArrowLeft className="size-4.5" aria-hidden />
          Exit to player app
        </Link>
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex min-h-10 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-sm font-semibold text-rose-200 hover:bg-rose-500/15"
          >
            <LogOut className="size-4.5" aria-hidden />
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
