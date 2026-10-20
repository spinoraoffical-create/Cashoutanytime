"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Menu } from "lucide-react";

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
  hints = {},
}: {
  items: AdminNavItem[];
  email: string | null;
  topRole: string;
  badges?: Record<string, number>;
  hints?: Record<string, string>;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-10 border-b border-white/10 bg-[#0b1022]/95 backdrop-blur">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild className="lg:hidden">
            <Button variant="ghost" size="icon" aria-label="Open admin menu">
              <Menu className="size-5" aria-hidden />
            </Button>
          </SheetTrigger>
            <SheetContent
            side="left"
            className="w-[min(100%,18rem)] border-r border-white/10 bg-[#090e1c] p-0 text-[#e8eefc]"
          >
            <SheetHeader className="border-b border-white/10 px-4 py-4">
              <SheetTitle>
                <span className="flex items-center gap-2">
                  <Logo size="sm" href={null} />
                  <span className="text-sm font-semibold text-white">Control Center</span>
                </span>
              </SheetTitle>
            </SheetHeader>
            <AdminSidebar items={items} onNavigate={() => setOpen(false)} badges={badges} hints={hints} />
          </SheetContent>
        </Sheet>

        <div className="flex items-center gap-2 lg:hidden">
          <Logo size="sm" withWordmark={false} />
          <Badge className="border border-cyan-300/30 bg-cyan-400/10 text-cyan-100 uppercase">Admin</Badge>
        </div>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <Button asChild variant="outline" className="min-h-10 border-cyan-300/40 bg-cyan-400/10 text-cyan-50 hover:bg-cyan-400/20">
            <Link href="/dashboard">
              <ArrowLeft className="size-4" aria-hidden />
              Exit Admin
            </Link>
          </Button>
          <div className="hidden min-w-0 text-right sm:block">
            <p className="truncate text-sm font-medium text-white">{email ?? "Account email is not on file"}</p>
            <p className="text-xs text-[#9fb0d0]">{topRole}</p>
          </div>
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
