"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { AdminNavItem } from "@/components/admin/admin-sidebar";

export function AdminBreadcrumbs({ items }: { items: AdminNavItem[] }) {
  const pathname = usePathname();
  if (pathname === "/admin") return null;
  const section = items.find(
    (item) => item.href === pathname || (item.children ?? []).some((child) => pathname === child.href || pathname.startsWith(`${child.href}/`))
  );
  const child = section?.children?.find((entry) => pathname === entry.href || pathname.startsWith(`${entry.href}/`));
  return (
    <nav aria-label="Breadcrumb" className="mb-4 text-xs text-[#9fb0d0]">
      <ol className="flex flex-wrap items-center gap-1.5">
        <li>
          <Link href="/admin" className="hover:text-white">
            Dashboard
          </Link>
        </li>
        {section ? (
          <li className="before:mr-1.5 before:content-['/']">
            <Link href={section.href} className="hover:text-white">
              {section.label}
            </Link>
          </li>
        ) : null}
        {child && child.href !== section?.href ? (
          <li className="before:mr-1.5 before:content-['/']">
            <span className="text-white">{child.label}</span>
          </li>
        ) : null}
      </ol>
    </nav>
  );
}
