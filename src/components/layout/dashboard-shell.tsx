"use client";

import { useEffect, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { LobbyAppShell } from "@/components/home/lobby/lobby-app-shell";

interface DashboardShellProps {
  children: React.ReactNode;
  sidebar?: ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("verified") === "1") {
      toast.success("Welcome to Sweepstakes Hub! Your email is verified.");
    }
  }, [searchParams]);

  return <LobbyAppShell>{children}</LobbyAppShell>;
}
