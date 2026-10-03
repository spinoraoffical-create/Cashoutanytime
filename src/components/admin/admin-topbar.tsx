"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink, Menu } from "lucide-react";

import {
  AdminSidebar,
  type AdminNavItem,
} from "@/components/admin/admin-sidebar";
import { Logo } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function AdminTopbar({
  items,
  email,
  topRole,
  badges = {},
}: {
  items: AdminNavItem[];
  email: string | null;
  topRole: string;
  badges?: Record<string, number>;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <header className="glass sticky top-0 z-10 border-x-0 border-t-0">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild className="lg:hidden">
            <Button variant="ghost" size="icon" aria-label="Open admin menu">
              <Menu className="size-5" aria-hidden />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="glass-strong w-72 border-r border-border p-0"
          >
            <SheetHeader className="border-b border-border px-4 py-4">
              <SheetTitle>
                <span className="flex items-center gap-2">
                  <Logo size="sm" href={null} />
                  <Badge className="bg-ws-green/15 text-ws-green-deep uppercase dark:text-ws-green">
                    Admin
                  </Badge>
                </span>
              </SheetTitle>
            </SheetHeader>
            <AdminSidebar items={items} onNavigate={() => setOpen(false)} badges={badges} />
          </SheetContent>
        </Sheet>

        <div className="flex items-center gap-2 lg:hidden">
          <Logo size="sm" withWordmark={false} />
          <Badge className="bg-ws-green/15 text-ws-green-deep uppercase dark:text-ws-green">Admin</Badge>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="truncate text-sm font-medium">{email}</p>
            <p className="hud-label text-ws-text-faint">{topRole}</p>
          </div>
          <Button asChild variant="ghost" size="icon" title="Visit website">
            <Link href="/" aria-label="Visit website">
              <ExternalLink className="size-5" aria-hidden />
            </Link>
          </Button>
          <ThemeToggle />
          <Avatar className="size-9">
            <AvatarFallback className="bg-ws-surface-3 text-xs font-bold">
              {email?.slice(0, 2).toUpperCase() ?? "WS"}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}
