"use client";

import { useEffect, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { LobbyAppShell } from "@/components/home/lobby/lobby-app-shell";

interface DashboardShellProps {
  children: React.ReactNode;
  sidebar: ReactNode;
}

/** Dashboard uses the same VIP casino shell as the lobby. */
export function DashboardShell({ children, sidebar }: DashboardShellProps) {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("verified") === "1") {
      toast.success("Welcome to Spinora! Your email is verified.");
    }
  }, [searchParams]);

  return (
    <LobbyAppShell sidebar={sidebar}>
      <div className="vip-page-content mx-auto w-full max-w-5xl px-3 py-2 sm:px-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-4">
        {children}
      </div>
    </LobbyAppShell>
  );
}
