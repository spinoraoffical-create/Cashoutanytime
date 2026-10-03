"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  Crown,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Sparkles,
  User,
  Users,
  StarHalf,
  Target,
  Gamepad2,
  Banknote,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { logoutUser } from "@/lib/auth/logout";
import { cn } from "@/lib/utils";
import { useUnreadMessages } from "@/hooks/use-unread-messages";
import { UnreadBadge } from "@/components/ui/unread-badge";
import { toast } from "sonner";

const MENU_LINKS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/#games", label: "Games", icon: Gamepad2 },
  { href: "/dashboard/deposit", label: "Deposit", icon: Banknote },
  { href: "/dashboard/messages", label: "Messages", icon: MessageSquare },
  { href: "/dashboard/vip", label: "VIP Status", icon: Crown },
  { href: "/dashboard/referrals", label: "Referrals", icon: Users },
  { href: "/dashboard/reviews", label: "Reviews", icon: StarHalf },
  { href: "/spin", label: "Daily Spin", icon: Sparkles },
];

export function UserAccountMenu({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [name, setName] = useState("Account");
  const [email, setEmail] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const { count: unreadMessages } = useUnreadMessages();

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function loadUser() {
      const supabase = createClient();
      if (!supabase) return;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      setEmail(user.email ?? "");
      setName(user.email?.split("@")[0] ?? "Account");

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      if (!cancelled && profile?.full_name) setName(profile.full_name);
    }

    void loadUser();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onClickOutside(e: MouseEvent) {
      if (containerRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }

    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setOpen(false);
    const { error } = await logoutUser("/");
    if (error) {
      toast.error(error);
      setLoggingOut(false);
    }
  }

  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center rounded-full bg-[#1e1e1e] border border-white/10 hover:border-orange-500/40 transition-colors",
          compact ? "p-0.5" : "gap-2 pl-1 pr-2 py-1"
        )}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span
          className={cn(
            "flex items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-amber-500 font-bold text-gray-900",
            compact ? "h-7 w-7 text-[10px]" : "h-8 w-8 text-xs"
          )}
        >
          {initials || <User className="h-4 w-4" />}
        </span>
        <span className="hidden sm:block text-sm font-medium text-white max-w-[100px] truncate capitalize">
          {name}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform hidden sm:block",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div
          className="absolute right-0 top-[calc(100%+8px)] z-[9999] w-60 rounded-xl border border-white/10 bg-[#1a1a1a] shadow-2xl shadow-black/60 overflow-hidden"
          role="menu"
        >
          <div className="px-4 py-3 border-b border-white/10">
            <p className="text-sm font-semibold text-white capitalize truncate">{name}</p>
            {email && <p className="text-xs text-muted-foreground truncate">{email}</p>}
          </div>
          <nav className="py-1">
            {MENU_LINKS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-muted-foreground hover:text-white hover:bg-white/5 transition-colors"
                role="menuitem"
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{label}</span>
                {href === "/dashboard/messages" && <UnreadBadge count={unreadMessages} />}
              </Link>
            ))}
          </nav>
          <div className="border-t border-white/10 p-1">
            <button
              type="button"
              disabled={loggingOut}
              onClick={() => void handleLogout()}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors rounded-lg disabled:opacity-50"
              role="menuitem"
            >
              <LogOut className="h-4 w-4" />
              {loggingOut ? "Logging out..." : "Logout"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
