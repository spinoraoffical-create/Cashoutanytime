"use client";

import { useEffect } from "react";
import { LobbyTopBar } from "@/components/home/lobby/lobby-top-bar";
import { LobbyBottomNav } from "@/components/home/lobby/lobby-bottom-nav";

interface LobbyAppShellProps {
  children: React.ReactNode;
}

export function LobbyAppShell({ children }: LobbyAppShellProps) {
  useEffect(() => {
    document.body.classList.add("lobby-mode");
    return () => document.body.classList.remove("lobby-mode");
  }, []);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <div className="lobby-layout mx-auto flex min-h-0 w-full max-w-[480px] flex-1 flex-col">
        <LobbyTopBar />
        <div className="lobby-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto scrollbar-hide px-4 pb-28 pt-3">
          {children}
        </div>
      </div>
      <LobbyBottomNav />
    </div>
  );
}
