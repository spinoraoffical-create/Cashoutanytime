"use client";

import { useEffect, useState } from "react";
import { Navbar } from "@/components/layout/navbar";
import { LobbyAppShell } from "@/components/home/lobby/lobby-app-shell";
import { createClient } from "@/lib/supabase/client";

interface VipGamePageShellProps {
  children: React.ReactNode;
}

function GuestGameFrame({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-background px-4 pb-24 pt-20">{children}</div>
    </>
  );
}

export function VipGamePageShell({ children }: VipGamePageShellProps) {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      setLoggedIn(false);
      return;
    }
    void supabase.auth.getUser().then(({ data: { user } }) => setLoggedIn(!!user));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") setLoggedIn(false);
      else if (event === "SIGNED_IN") setLoggedIn(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loggedIn === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-primary/40 border-t-primary"
          aria-label="Loading"
        />
      </div>
    );
  }

  if (loggedIn) {
    return (
      <LobbyAppShell>
        <div className="vip-page-content py-1">{children}</div>
      </LobbyAppShell>
    );
  }

  return <GuestGameFrame>{children}</GuestGameFrame>;
}

export function VipGamePageShellAuthed({ children }: VipGamePageShellProps) {
  return (
    <LobbyAppShell>
      <div className="vip-page-content py-1">{children}</div>
    </LobbyAppShell>
  );
}

export function VipGamePageShellWithWallet({ children }: VipGamePageShellProps) {
  return <VipGamePageShell>{children}</VipGamePageShell>;
}
