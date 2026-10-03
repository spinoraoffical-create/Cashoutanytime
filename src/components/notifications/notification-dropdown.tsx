"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Bell, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { markNotificationsRead } from "@/lib/actions/notifications";
import { formatRelativeTime, cn, createClientId } from "@/lib/utils";
import { unlockMessageNotificationSound, playMessageNotificationSound } from "@/lib/chat/message-notification-sound";

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

interface NotificationDropdownProps {
  className?: string;
  buttonClassName?: string;
  align?: "left" | "right";
}

const PANEL_WIDTH = 320;

export function NotificationDropdown({
  className,
  buttonClassName,
  align = "right",
}: NotificationDropdownProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [panelStyle, setPanelStyle] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const updatePanelPosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const left =
      align === "right"
        ? Math.max(8, rect.right - PANEL_WIDTH)
        : Math.min(rect.left, window.innerWidth - PANEL_WIDTH - 8);
    setPanelStyle({ top: rect.bottom + 8, left });
  }, [align]);

  const fetchNotifications = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    setIsLoggedIn(!!user);
    setUserId(user?.id ?? null);
    if (!user) return;

    setLoading(true);
    const { data } = await supabase
      .from("notifications")
      .select("id, title, message, type, is_read, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(6);

    setNotifications(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    setMounted(true);
    const supabase = createClient();
    if (!supabase) return;
    void supabase.auth.getUser().then(({ data: { user } }) => {
      setIsLoggedIn(!!user);
      setUserId(user?.id ?? null);
    });
  }, []);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const supabase = createClient();
    if (!supabase) return;

    const subscribe = () => {
      if (cancelled) return;

      const channel = supabase
        .channel(`notifications-${userId}-${createClientId()}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${userId}`,
          },
          () => {
            void playMessageNotificationSound();
            fetchNotifications();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    let unsubscribe: (() => void) | undefined;

    const start = () => {
      unsubscribe = subscribe();
    };

    if ("requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(start, { timeout: 6000 });
    } else {
      timeoutId = setTimeout(start, 3000);
    }

    return () => {
      cancelled = true;
      if (idleId !== undefined) window.cancelIdleCallback(idleId);
      if (timeoutId) clearTimeout(timeoutId);
      unsubscribe?.();
    };
  }, [userId, fetchNotifications]);

  useEffect(() => {
    if (!open) return;

    updatePanelPosition();
    async function loadAndMarkRead() {
      await fetchNotifications();
      const result = await markNotificationsRead();
      if (!result.error) {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      }
    }
    loadAndMarkRead();

    function onScrollOrResize() {
      updatePanelPosition();
    }
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [open, fetchNotifications, updatePanelPosition]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        containerRef.current?.contains(target) ||
        document.getElementById("notification-dropdown-panel")?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function handleToggle() {
    if (isLoggedIn === false) return;
    void unlockMessageNotificationSound();
    setOpen((v) => !v);
  }

  if (isLoggedIn === false) {
    return (
      <Link
        href="/login"
        className={cn(
          "flex items-center justify-center w-10 h-10 rounded-lg bg-[#1e1e1e] text-muted-foreground hover:text-white border border-white/5",
          buttonClassName
        )}
        aria-label="Login to view notifications"
      >
        <Bell className="h-5 w-5" />
      </Link>
    );
  }

  const panel = open && mounted && (
    <div
      id="notification-dropdown-panel"
      style={{ top: panelStyle.top, left: panelStyle.left, width: PANEL_WIDTH }}
      className="fixed z-[9999] rounded-xl border border-white/10 bg-[#1a1a1a] shadow-2xl shadow-black/60 overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#121212]">
        <h3 className="text-sm font-semibold text-white">Notifications</h3>
        {unreadCount > 0 && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400">
            {unreadCount} new
          </span>
        )}
      </div>

      <div className="max-h-[min(360px,60vh)] overflow-y-auto">
        {loading && notifications.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : notifications.length > 0 ? (
          <ul className="divide-y divide-white/5">
            {notifications.map((notif) => (
              <li
                key={notif.id}
                className={cn(
                  "px-4 py-3 hover:bg-white/5 transition-colors",
                  !notif.is_read && "bg-orange-500/5"
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-0.5">
                  <p className="text-sm font-medium text-white leading-snug">{notif.title}</p>
                  {!notif.is_read && (
                    <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{notif.message}</p>
                <p className="text-[10px] text-muted-foreground/70 mt-1">
                  {formatRelativeTime(notif.created_at)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-10 text-center text-sm text-muted-foreground">No notifications yet</p>
        )}
      </div>
    </div>
  );

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        className={cn(
          "flex items-center justify-center w-10 h-10 rounded-lg bg-[#1e1e1e] text-muted-foreground hover:text-white border border-white/5 relative transition-colors",
          open && "text-white border-orange-500/30",
          buttonClassName
        )}
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-[8px] h-2 px-0.5 rounded-full bg-red-500 ring-2 ring-[#121212]" />
        )}
      </button>

      {mounted && panel && createPortal(panel, document.body)}
    </div>
  );
}
