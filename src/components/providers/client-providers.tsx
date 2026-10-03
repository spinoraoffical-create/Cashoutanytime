"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Toaster } from "sonner";
import { MessageRealtimeProvider } from "@/components/chat/message-realtime-provider";
import { createClient } from "@/lib/supabase/client";
import { MessageRealtimeStubProvider } from "@/lib/chat/message-realtime-stub";

import { LiveWinPopup } from "@/components/ui/live-win-popup";
import { WelcomePromoModal } from "@/components/ui/welcome-promo-modal";

const REALTIME_ROUTE_PREFIXES = ["/dashboard", "/admin", "/spin"];

function needsRealtimeImmediately(pathname: string | null): boolean {
  if (!pathname) return false;
  return REALTIME_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function ClientProviders({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      setLoggedIn(false);
      return;
    }

    void supabase.auth.getUser().then(({ data: { user } }) => {
      setLoggedIn(!!user);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        setLoggedIn(true);
      } else if (event === "SIGNED_OUT") {
        setLoggedIn(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const useRealtime =
    loggedIn === true && needsRealtimeImmediately(pathname);

  const Provider = useRealtime ? MessageRealtimeProvider : MessageRealtimeStubProvider;

  return (
    <>
      <Provider>{children}</Provider>
      <Toaster richColors closeButton position="top-center" />
      <LiveWinPopup />
      <WelcomePromoModal />
    </>
  );
}
