"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LobbyAppShell } from "@/components/home/lobby/lobby-app-shell";
import { LobbySidebar, type LobbyMenuId } from "@/components/home/lobby/lobby-sidebar";
import { AppShell } from "@/components/layout/app-shell";
import { HomeSidebar } from "@/components/home/home-sidebar";
import { DeferredWalletCardLoader } from "@/components/wallet/deferred-wallet-card-loader";

interface VipGamePageShellProps {
  children: React.ReactNode;
}

/** Game pages: VIP shell when logged in, classic shell when logged out. */
export function VipGamePageShell({ children }: VipGamePageShellProps) {
  const router = useRouter();
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [lobbyMenu, setLobbyMenu] = useState<LobbyMenuId>("lobby");

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
      <div className="lobby-cosmic min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-purple-600 border-t-amber-400 animate-spin" aria-label="Loading" />
      </div>
    );
  }

  if (loggedIn) {
    return (
      <LobbyAppShell
        sidebar={
          <LobbySidebar
            activeMenu={lobbyMenu}
            onMenuChange={(menu) => {
              setLobbyMenu(menu);
              if (menu === "lobby") router.push("/");
              else router.push("/#games");
            }}
          />
        }
      >
        <div className="vip-page-content max-w-4xl mx-auto py-2 px-1">{children}</div>
      </LobbyAppShell>
    );
  }

  return (
    <AppShell
      onSearchClick={() => router.push("/#games")}
      sidebar={
        <HomeSidebar
          activeTab="all"
          onTabChange={() => router.push("/")}
          onSearchClick={() => router.push("/#games")}
        />
      }
    >
      {children}
    </AppShell>
  );
}

/** Logged-in game shell with wallet in sidebar */
export function VipGamePageShellAuthed({ children }: VipGamePageShellProps) {
  const router = useRouter();
  const [lobbyMenu, setLobbyMenu] = useState<LobbyMenuId>("lobby");

  return (
    <LobbyAppShell
      sidebar={
        <LobbySidebar
          activeMenu={lobbyMenu}
          onMenuChange={(menu) => {
            setLobbyMenu(menu);
            if (menu === "lobby") router.push("/");
            else router.push("/#games");
          }}
        />
      }
    >
      <div className="vip-page-content max-w-4xl mx-auto py-2 px-1">{children}</div>
    </LobbyAppShell>
  );
}

export function VipGamePageShellWithWallet({ children }: VipGamePageShellProps) {
  const router = useRouter();
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [lobbyMenu, setLobbyMenu] = useState<LobbyMenuId>("lobby");

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
      <div className="lobby-cosmic min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-purple-600 border-t-amber-400 animate-spin" aria-label="Loading" />
      </div>
    );
  }

  if (loggedIn) {
    return (
      <LobbyAppShell
        sidebar={
          <LobbySidebar
            activeMenu={lobbyMenu}
            onMenuChange={(menu) => {
              setLobbyMenu(menu);
              if (menu === "lobby") router.push("/");
              else router.push("/#games");
            }}
          />
        }
      >
        <div className="vip-page-content max-w-4xl mx-auto py-2 px-1">{children}</div>
      </LobbyAppShell>
    );
  }

  return (
    <AppShell
      onSearchClick={() => router.push("/#games")}
      sidebar={
        <HomeSidebar
          activeTab="all"
          onTabChange={() => router.push("/")}
          onSearchClick={() => router.push("/#games")}
          walletSlot={<DeferredWalletCardLoader />}
        />
      }
    >
      {children}
    </AppShell>
  );
}
