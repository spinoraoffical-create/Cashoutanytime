"use client";

import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import dynamic from "next/dynamic";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { cn } from "@/lib/utils";

const MarqueeTicker = dynamic(
  () => import("@/components/ui/MarqueeTicker").then((m) => ({ default: m.MarqueeTicker })),
  { ssr: false, loading: () => <div className="h-9 bg-[#0d0318] border-y border-purple-900/40" aria-hidden /> }
);

const DeferredCookieConsent = dynamic(
  () =>
    import("@/components/ui/deferred-cookie-consent").then((m) => ({
      default: m.DeferredCookieConsent,
    })),
  { ssr: false }
);

interface AppShellProps {
  children: React.ReactNode;
  sidebar: React.ReactNode;
  onSearchClick?: () => void;
  showFooter?: boolean;
  showTicker?: boolean;
}

export function AppShell({
  children,
  sidebar,
  onSearchClick,
  showFooter = true,
  showTicker = true,
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

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
    <div className="min-h-screen bg-[#121212] text-foreground">
      <Navbar
        onMenuClick={() => setMobileOpen(true)}
        onSearchClick={onSearchClick}
      />
      <div className="pt-16">
        {showTicker && <MarqueeTicker />}

      {mobileOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black/70 mobile-drawer-backdrop"
            onClick={closeMobile}
            aria-hidden
          />
          <aside
            className={cn(
              "lg:hidden fixed left-0 top-16 bottom-0 z-40 w-[min(18rem,88vw)] overflow-y-auto",
              "bg-[#121212] border-r border-white/10 shadow-2xl mobile-drawer-panel"
            )}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
          >
            <div className="sticky top-0 z-10 flex items-center justify-end p-3 bg-[#121212]/95 backdrop-blur-sm border-b border-white/5">
              <button
                type="button"
                onClick={closeMobile}
                className="flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div
              className="p-3 pt-0 [&_aside]:min-h-0 [&_aside]:rounded-none [&_aside]:border-0 [&_aside]:shadow-none [&_aside]:bg-transparent"
              onClick={handleSidebarClick}
            >
              {sidebar}
            </div>
          </aside>
        </>
      )}

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6">
        <div className="flex gap-4 lg:gap-6 items-start">
          <div className="hidden lg:block w-64 xl:w-72 shrink-0 sticky top-20 self-start max-h-[calc(100vh-5rem)] overflow-y-auto scrollbar-hide">
            {sidebar}
          </div>
          <main className="flex-1 min-w-0 pb-8">{children}</main>
        </div>
      </div>
      </div>

      {showFooter && <Footer fullWidth />}
      <DeferredCookieConsent />
    </div>
  );
}
