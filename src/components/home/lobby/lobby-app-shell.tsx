"use client";

import { useEffect } from "react";
import { LobbyTopBar } from "@/components/home/lobby/lobby-top-bar";
import { LobbyDesktopHeader } from "@/components/home/lobby/lobby-desktop-header";
import { LobbyDesktopSidebar } from "@/components/home/lobby/lobby-desktop-sidebar";
import { LobbyBottomNav } from "@/components/home/lobby/lobby-bottom-nav";
import { EnterFloorSplash } from "@/components/player/enter-floor-splash";
import { BreakReminder } from "@/components/player/break-reminder";

export function LobbyAppShell({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.body.classList.add("lobby-mode");
    const size = localStorage.getItem("hub-text-size");
    if (size) document.documentElement.dataset.text = size;
    return () => document.body.classList.remove("lobby-mode");
  }, []);

  return (
    <div className="jg-stage flex h-[100dvh] min-h-0 w-full overflow-hidden bg-[#030b26] lg:min-h-screen">
      <EnterFloorSplash />
      <BreakReminder />
      <LobbyDesktopSidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <LobbyDesktopHeader />
        <LobbyTopBar />
        <div className="jg-inside-main min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
          <div className="mx-auto w-full max-w-[1280px] px-4 pb-6 pt-4 lg:px-6 lg:pb-10 lg:pt-6">
            {children}
          </div>
        </div>
        <LobbyBottomNav />
      </div>
    </div>
  );
}
