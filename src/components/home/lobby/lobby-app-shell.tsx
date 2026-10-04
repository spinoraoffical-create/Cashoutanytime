"use client";

import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import { LobbyTopBar } from "@/components/home/lobby/lobby-top-bar";
import { LobbyBottomNav } from "@/components/home/lobby/lobby-bottom-nav";

interface LobbyAppShellProps {
  children: React.ReactNode;
  sidebar: React.ReactNode;
}

export function LobbyAppShell({ children, sidebar }: LobbyAppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  useEffect(() => {
    document.body.classList.add("lobby-mode");
    return () => document.body.classList.remove("lobby-mode");
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeMobile();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen, closeMobile]);

  function handleSidebarClick(e: React.MouseEvent) {
    const target = (e.target as HTMLElement).closest("a, button");
    if (target) closeMobile();
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-background">
      <div className="lobby-layout flex flex-1 min-h-0 mx-auto w-full max-w-lg lg:max-w-5xl">
        <aside className="lobby-sidebar-rail hidden xl:flex flex-col w-[200px] shrink-0 overflow-y-auto scrollbar-hide border-r border-white/6">
          {sidebar}
        </aside>

        <div className="lobby-main-col flex flex-col flex-1 min-w-0 min-h-0">
          <LobbyTopBar onMenuClick={() => setMobileOpen(true)} />
          <div className="lobby-scroll flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-hide px-3 sm:px-4 pb-24 pt-3">
            {children}
          </div>
        </div>
      </div>

      <LobbyBottomNav />

      {mobileOpen && (
        <>
          <div className="lg:hidden fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm" onClick={closeMobile} aria-hidden />
          <aside
            className="lg:hidden fixed left-0 top-0 bottom-0 z-[70] w-[min(17rem,88vw)] overflow-y-auto lobby-sidebar-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Lobby menu"
          >
            <div className="sticky top-0 z-10 flex justify-end p-2 bg-[#2a004f]/95 border-b border-purple-500/30">
              <button type="button" onClick={closeMobile} className="w-8 h-8 rounded-lg text-purple-300 hover:text-white flex items-center justify-center" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div onClick={handleSidebarClick}>{sidebar}</div>
          </aside>
        </>
      )}
    </div>
  );
}
