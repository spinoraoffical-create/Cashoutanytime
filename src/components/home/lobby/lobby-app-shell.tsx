"use client";

import { useEffect } from "react";
import { LobbyTopBar } from "@/components/home/lobby/lobby-top-bar";
import { LobbyBottomNav } from "@/components/home/lobby/lobby-bottom-nav";
import { EnterFloorSplash } from "@/components/player/enter-floor-splash";

export function LobbyAppShell({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.body.classList.add("lobby-mode");
    const size = localStorage.getItem("hub-text-size");
    if (size) document.documentElement.dataset.text = size;
    return () => document.body.classList.remove("lobby-mode");
  }, []);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#07060c]">
      <EnterFloorSplash />
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
