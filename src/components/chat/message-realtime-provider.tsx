"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { Headphones, MessageCircle, User, X, Gamepad2, CheckCircle, Banknote } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  getAdminUnreadMessageCount,
  getUnreadMessageCount,
} from "@/lib/actions/messages";
import { UnreadBadge } from "@/components/ui/unread-badge";
import { SitePresenceHeartbeat } from "@/components/presence/site-presence-heartbeat";
import {
  CHAT_INCOMING_EVENT,
  GAME_REQUEST_EVENT,
  DEPOSIT_REQUEST_EVENT,
  type ChatIncomingDetail,
  type DepositRequestEventDetail,
  type GameRequestEventDetail,
} from "@/lib/chat/events";
import { getDepositMethod, type DepositPaymentMethodId } from "@/lib/payments/methods";
import { subscribeToConversationInserts, subscribeToMessageInserts } from "@/lib/chat/subscribe-messages";
import { UserQuickChat } from "@/components/chat/user-quick-chat";
import {
  MessageRealtimeContext,
} from "@/lib/chat/message-realtime-context";
import {
  playIncomingMessageSound,
  playMessageNotificationSound,
  resumeMessageNotificationAudio,
  unlockMessageNotificationSound,
} from "@/lib/chat/message-notification-sound";
import { ensureUserConversation } from "@/lib/actions/messages";
import { ensureUserConversationClient } from "@/lib/chat/ensure-user-conversation-client";
import { FloatingSocialLinks } from "@/components/layout/social-links";
import { messagePreview } from "@/lib/chat/message-preview";
import type { GameRequest, Message } from "@/types/database";

type ActivityPopupKind =
  | "message"
  | "game_request_new"
  | "game_request_update"
  | "deposit_new";

interface ActivityPopup {
  id: string;
  kind: ActivityPopupKind;
  title: string;
  preview: string;
  href: string;
  isAdminView: boolean;
}

function isOnRequestsPage(path: string | null, adminView: boolean): boolean {
  if (adminView) return Boolean(path?.startsWith("/admin/requests"));
  return Boolean(path?.startsWith("/dashboard/requests"));
}

function isOnDepositsPage(path: string | null, adminView: boolean): boolean {
  if (adminView) return Boolean(path?.startsWith("/admin/deposits"));
  return Boolean(path?.startsWith("/dashboard/deposits"));
}

function isOnChatInboxPage(path: string | null, adminView: boolean): boolean {
  if (adminView) return Boolean(path?.startsWith("/admin/chat"));
  return Boolean(path?.startsWith("/dashboard/messages"));
}

export function MessageRealtimeProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [count, setCount] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [popup, setPopup] = useState<ActivityPopup | null>(null);
  const [quickChatOpen, setQuickChatOpen] = useState(false);
  const [quickChatConvId, setQuickChatConvId] = useState<string | null>(null);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [conversationIds, setConversationIds] = useState<string[]>([]);
  const userIdRef = useRef<string | null>(null);
  const isAdminRef = useRef(false);
  const pathnameRef = useRef(pathname);
  const popupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openingChatRef = useRef(false);
  const openingActivityRef = useRef(false);

  pathnameRef.current = pathname;

  const onInboxPage =
    pathname?.startsWith("/admin/chat") || pathname?.startsWith("/dashboard/messages");

  const syncConversations = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      userIdRef.current = null;
      setConversationIds([]);
      setCount(0);
      setIsAdmin(false);
      setIsLoggedIn(false);
      return;
    }

    setIsLoggedIn(true);
    userIdRef.current = user.id;
    setActiveUserId(user.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const admin = profile?.role === "admin";
    setIsAdmin(admin);
    isAdminRef.current = admin;

    const query = admin
      ? supabase.from("conversations").select("id").eq("is_active", true)
      : supabase
          .from("conversations")
          .select("id")
          .eq("user_id", user.id)
          .eq("is_active", true);

    const { data: conversations } = await query;
    const ids = conversations?.map((c) => c.id) ?? [];
    setConversationIds(ids);
    if (!admin && ids[0]) {
      setQuickChatConvId((prev) => prev ?? ids[0]);
    }

    void (admin ? getAdminUnreadMessageCount() : getUnreadMessageCount()).then((total) => {
      setCount(total);
    });
  }, []);

  const refresh = useCallback(async () => {
    await syncConversations();
  }, [syncConversations]);

  const scheduleRefresh = useCallback(() => {
    if (refreshDebounceRef.current) clearTimeout(refreshDebounceRef.current);
    refreshDebounceRef.current = setTimeout(() => {
      void syncConversations();
    }, 200);
  }, [syncConversations]);

  const showActivityPopup = useCallback((popupData: ActivityPopup) => {
    setPopup(popupData);
    if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
    popupTimerRef.current = setTimeout(() => setPopup(null), 6000);
  }, []);

  const showMessagePopup = useCallback(
    async (msg: Message, href: string) => {
      const adminView = isAdminRef.current;

      let title = adminView ? "New customer message" : "Spinora Support";

      if (adminView) {
        const supabase = createClient();
        if (supabase) {
          const { data: sender } = await supabase
            .from("profiles")
            .select("full_name, email")
            .eq("id", msg.sender_id)
            .single();
          title = sender?.full_name || sender?.email?.split("@")[0] || "Customer";
        }
      }

      showActivityPopup({
        id: msg.id,
        kind: "message",
        title,
        preview: messagePreview(msg),
        href,
        isAdminView: adminView,
      });
    },
    [showActivityPopup]
  );

  const openChatForMessage = useCallback(
    async (msg: Message) => {
      const userId = userIdRef.current;
      if (!userId || msg.sender_id === userId) return;

      const adminView = isAdminRef.current;
      const path = pathnameRef.current;

      playIncomingMessageSound(msg.sender_id, userId);
      setCount((c) => c + 1);
      scheduleRefresh();

      if (isOnChatInboxPage(path, adminView)) {
        window.dispatchEvent(
          new CustomEvent<ChatIncomingDetail>(CHAT_INCOMING_EVENT, {
            detail: { conversationId: msg.conversation_id, message: msg },
          })
        );
        return;
      }

      if (!adminView) {
        setQuickChatConvId(msg.conversation_id);
        setQuickChatOpen(true);
        void showMessagePopup(
          msg,
          `/dashboard/messages?conversation=${msg.conversation_id}`
        );
        return;
      }

      if (openingChatRef.current) return;
      openingChatRef.current = true;

      try {
        let msgHref = adminView ? "/admin/chat" : `/dashboard/messages?conversation=${msg.conversation_id}`;

        if (adminView) {
          const supabase = createClient();
          const { data: conv } = supabase
            ? await supabase
                .from("conversations")
                .select("user_id")
                .eq("id", msg.conversation_id)
                .single()
            : { data: null };

          msgHref = conv?.user_id ? `/admin/chat?userId=${conv.user_id}` : "/admin/chat";
          router.push(msgHref);
          void showMessagePopup(msg, msgHref);
        } else {
          router.push(msgHref);
          void showMessagePopup(msg, msgHref);
        }
      } finally {
        setTimeout(() => {
          openingChatRef.current = false;
        }, 300);
      }
    },
    [router, scheduleRefresh, showMessagePopup]
  );

  const openGameRequestActivity = useCallback(
    async (
      request: Pick<GameRequest, "id" | "game_name" | "status" | "user_id">,
      kind: GameRequestEventDetail["kind"]
    ) => {
      const adminView = isAdminRef.current;
      const path = pathnameRef.current;

      void playMessageNotificationSound();

      const eventDetail: GameRequestEventDetail = { kind, requestId: request.id };
      window.dispatchEvent(
        new CustomEvent<GameRequestEventDetail>(GAME_REQUEST_EVENT, { detail: eventDetail })
      );

      const href = adminView ? "/admin/requests?status=pending" : "/dashboard/requests";

      let title = adminView ? "New game request" : "Game Account Ready!";
      let preview = adminView
        ? `${request.game_name} requested`
        : `Your ${request.game_name} account is ready`;

      if (adminView && kind === "new") {
        const supabase = createClient();
        if (supabase) {
          const { data: customer } = await supabase
            .from("profiles")
            .select("full_name, email")
            .eq("id", request.user_id)
            .single();
          const name = customer?.full_name || customer?.email?.split("@")[0] || "Customer";
          title = name;
          preview = `Requested ${request.game_name} — tap to review`;
        }
      }

      if (!adminView && request.status === "rejected") {
        title = "Game request update";
        preview = `Your ${request.game_name} request was not completed`;
      } else if (!adminView && request.status === "processing") {
        title = "Request in progress";
        preview = `We're creating your ${request.game_name} account`;
      }

      if (isOnRequestsPage(path, adminView)) {
        showActivityPopup({
          id: request.id,
          kind: adminView ? "game_request_new" : "game_request_update",
          title,
          preview,
          href,
          isAdminView: adminView,
        });
        return;
      }

      if (openingActivityRef.current) return;
      openingActivityRef.current = true;

      try {
        showActivityPopup({
          id: request.id,
          kind: adminView ? "game_request_new" : "game_request_update",
          title,
          preview,
          href,
          isAdminView: adminView,
        });

        router.push(href);
      } finally {
        setTimeout(() => {
          openingActivityRef.current = false;
        }, 800);
      }
    },
    [router, showActivityPopup]
  );

  const openGameRequestActivityRef = useRef(openGameRequestActivity);
  openGameRequestActivityRef.current = openGameRequestActivity;

  const openDepositActivity = useCallback(
    async (deposit: {
      id: string;
      user_id: string;
      game_name: string;
      payment_method: DepositPaymentMethodId;
      amount: number | null;
    }) => {
      const adminView = isAdminRef.current;
      if (!adminView) return;

      const path = pathnameRef.current;
      const method = getDepositMethod(deposit.payment_method);

      void playMessageNotificationSound();

      window.dispatchEvent(
        new CustomEvent<DepositRequestEventDetail>(DEPOSIT_REQUEST_EVENT, {
          detail: { kind: "new", depositId: deposit.id },
        })
      );

      const href = "/admin/deposits?status=pending";
      let title = "New deposit proof";
      let preview = `${deposit.game_name} via ${method?.label ?? deposit.payment_method}`;

      const supabase = createClient();
      if (supabase) {
        const { data: player } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("id", deposit.user_id)
          .single();
        const name = player?.full_name || player?.email?.split("@")[0] || "Player";
        title = name;
        preview = `$${deposit.amount != null && deposit.amount > 0 ? deposit.amount.toFixed(2) : "—"} · ${deposit.game_name} · ${method?.label ?? deposit.payment_method}`;
      }

      if (isOnDepositsPage(path, true)) {
        showActivityPopup({
          id: deposit.id,
          kind: "deposit_new",
          title,
          preview,
          href,
          isAdminView: true,
        });
        return;
      }

      if (openingActivityRef.current) return;
      openingActivityRef.current = true;

      try {
        showActivityPopup({
          id: deposit.id,
          kind: "deposit_new",
          title,
          preview,
          href,
          isAdminView: true,
        });
        router.push(href);
      } finally {
        setTimeout(() => {
          openingActivityRef.current = false;
        }, 800);
      }
    },
    [router, showActivityPopup]
  );

  const openDepositActivityRef = useRef(openDepositActivity);
  openDepositActivityRef.current = openDepositActivity;

  const handleIncomingMessage = useCallback(
    (msg: Message) => {
      void openChatForMessage(msg);
    },
    [openChatForMessage]
  );

  const handleIncomingMessageRef = useRef(handleIncomingMessage);
  handleIncomingMessageRef.current = handleIncomingMessage;

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;

    let cancelled = false;

    const runSync = () => {
      if (!cancelled) void syncConversations();
    };

    // Defer first sync so the page paints before network work.
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) runSync();
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        runSync();
      } else if (event === "SIGNED_OUT") {
        userIdRef.current = null;
        setActiveUserId(null);
        setConversationIds([]);
        setQuickChatOpen(false);
        setQuickChatConvId(null);
        setCount(0);
        setIsAdmin(false);
        setIsLoggedIn(false);
      }
    });

    const interval = setInterval(() => {
      if (document.visibilityState === "visible" && userIdRef.current) {
        runSync();
      }
    }, 120_000);

    function onVisible() {
      if (document.visibilityState === "visible") {
        resumeMessageNotificationAudio();
        if (userIdRef.current) runSync();
      }
    }

    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      subscription.unsubscribe();
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      if (refreshDebounceRef.current) clearTimeout(refreshDebounceRef.current);
    };
  }, [syncConversations]);

  useEffect(() => {
    if (!isLoggedIn) return;

    function unlock() {
      void unlockMessageNotificationSound();
    }
    const gestureOpts: AddEventListenerOptions = { capture: true };
    document.addEventListener("pointerdown", unlock, gestureOpts);
    document.addEventListener("touchend", unlock, gestureOpts);
    document.addEventListener("keydown", unlock);
    return () => {
      document.removeEventListener("pointerdown", unlock, gestureOpts);
      document.removeEventListener("touchend", unlock, gestureOpts);
      document.removeEventListener("keydown", unlock);
    };
  }, [isLoggedIn]);

  useEffect(() => {
    if (onInboxPage) return;

    const supabase = createClient();
    if (!supabase || !activeUserId || !isLoggedIn) return;

    const userId = activeUserId;
    const isAdminUser = isAdminRef.current;

    if (isAdminUser || conversationIds.length === 0) {
      return subscribeToMessageInserts(
        supabase,
        `msg-rt-all-${userId}`,
        userId,
        (msg) => handleIncomingMessageRef.current(msg)
      );
    }

    const unsubs = conversationIds.map((conversationId) =>
      subscribeToConversationInserts(
        supabase,
        `msg-rt-conv-${userId}-${conversationId}`,
        conversationId,
        (msg) => {
          if (msg.sender_id === userId) return;
          handleIncomingMessageRef.current(msg);
        }
      )
    );

    return () => {
      for (const unsub of unsubs) unsub();
    };
  }, [onInboxPage, isLoggedIn, activeUserId, conversationIds]);

  useEffect(() => {
    if (!isLoggedIn) return;

    const supabase = createClient();
    if (!supabase || !userIdRef.current) return;

    const userId = userIdRef.current;
    const channels: ReturnType<typeof supabase.channel>[] = [];

    if (isAdmin) {
      const adminChannel = supabase
        .channel(`game-req-admin-${userId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "game_requests" },
          (payload) => {
            const req = payload.new as GameRequest;
            if (req.user_id === userId) return;
            void openGameRequestActivityRef.current(req, "new");
          }
        )
        .subscribe();
      channels.push(adminChannel);
    } else {
      const userChannel = supabase
        .channel(`game-req-user-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "game_requests",
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            const req = payload.new as GameRequest;
            const old = payload.old as Partial<GameRequest>;
            if (!req.status || req.status === old.status) return;
            if (!["completed", "rejected", "processing"].includes(req.status)) return;

            const kind: GameRequestEventDetail["kind"] =
              req.status === "completed"
                ? "completed"
                : req.status === "rejected"
                  ? "rejected"
                  : "updated";

            void openGameRequestActivityRef.current(req, kind);
          }
        )
        .subscribe();
      channels.push(userChannel);
    }

    return () => {
      for (const ch of channels) supabase.removeChannel(ch);
    };
  }, [isLoggedIn, isAdmin]);

  useEffect(() => {
    if (!isLoggedIn || !isAdmin) return;

    const supabase = createClient();
    if (!supabase || !userIdRef.current) return;

    const userId = userIdRef.current;
    const channel = supabase
      .channel(`deposit-admin-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "deposit_requests" },
        (payload) => {
          const dep = payload.new as {
            id: string;
            user_id: string;
            game_name: string;
            payment_method: DepositPaymentMethodId;
            amount: number | null;
          };
          if (dep.user_id === userId) return;
          void openDepositActivityRef.current(dep);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isLoggedIn, isAdmin]);

  function openActivityPopup() {
    if (!popup) return;
    const item = popup;
    setPopup(null);

    if (item.kind === "message" && !item.isAdminView) {
      const match = item.href.match(/conversation=([^&]+)/);
      if (match?.[1]) setQuickChatConvId(match[1]);
      setQuickChatOpen(true);
      return;
    }

    router.push(item.href);
  }

  function popupIcon(item: ActivityPopup) {
    if (item.kind === "message") {
      return item.isAdminView ? (
        <User className="h-5 w-5 text-white" />
      ) : (
        <Headphones className="h-5 w-5 text-white" />
      );
    }
    if (item.kind === "deposit_new") {
      return <Banknote className="h-5 w-5 text-white" />;
    }
    if (item.kind === "game_request_update") {
      return <CheckCircle className="h-5 w-5 text-white" />;
    }
    return <Gamepad2 className="h-5 w-5 text-white" />;
  }

  function popupActionLabel(item: ActivityPopup) {
    if (item.kind === "message") return "Tap to open chat";
    if (item.kind === "deposit_new") return "Tap to review deposit";
    return "Tap to view request";
  }

  const onAdminRoute = Boolean(pathname?.startsWith("/admin"));

  const hideFab =
    (onAdminRoute && pathname?.startsWith("/admin/chat")) ||
    (!onAdminRoute && pathname?.startsWith("/dashboard/messages"));

  const contextValue = useMemo(
    () => ({ count, isAdmin, refresh }),
    [count, isAdmin, refresh]
  );

  return (
    <MessageRealtimeContext.Provider value={contextValue}>
      {isLoggedIn && <SitePresenceHeartbeat />}
      {children}

      {!hideFab && isLoggedIn && (
        <div className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] sm:bottom-6 sm:right-6 z-[130] flex flex-col items-center gap-2 pointer-events-none">
          <FloatingSocialLinks />
          <button
            type="button"
            onClick={() => {
            void unlockMessageNotificationSound();
            if (onAdminRoute) {
              setQuickChatOpen(false);
              router.push("/admin/chat");
              return;
            }
            if (quickChatOpen) {
              setQuickChatOpen(false);
              return;
            }
            void (async () => {
              try {
                const uid = activeUserId ?? userIdRef.current;
                if (!uid) {
                  router.push("/dashboard/messages");
                  return;
                }

                let convId = quickChatConvId;
                if (!convId) {
                  const supabase = createClient();
                  if (supabase) {
                    convId = await ensureUserConversationClient(supabase, uid);
                  }
                  if (!convId) {
                    const ensured = await ensureUserConversation();
                    convId = ensured.conversationId ?? null;
                  }
                }

                if (!convId) {
                  router.push("/dashboard/messages");
                  return;
                }

                setQuickChatConvId(convId);
                setQuickChatOpen(true);
              } catch {
                router.push("/dashboard/messages");
              }
            })();
          }}
          className="relative w-14 h-14 rounded-full gradient-bg flex items-center justify-center shadow-lg glow-purple touch-manipulation pointer-events-auto"
          aria-label={onAdminRoute ? "Open customer chat" : "Open live chat"}
        >
          <MessageCircle className="h-6 w-6 text-white" />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5">
              <UnreadBadge count={count} className="ring-2 ring-[#121212]" />
            </span>
          )}
        </button>
        </div>
      )}

      {!onAdminRoute && !onInboxPage && isLoggedIn && quickChatOpen && quickChatConvId && activeUserId && (
        <UserQuickChat
          open={quickChatOpen}
          conversationId={quickChatConvId}
          userId={activeUserId}
          onClose={() => setQuickChatOpen(false)}
        />
      )}

      {popup && (
        <button
          type="button"
          onClick={openActivityPopup}
          className="fixed z-[9998] left-3 right-3 sm:left-auto sm:right-auto sm:w-[320px] bottom-[5.5rem] sm:bottom-6 sm:left-6 flex items-start gap-3 p-3 rounded-2xl border border-white/10 bg-[#1a1a1a] shadow-2xl shadow-black/50 text-left hover:bg-[#222] transition-opacity duration-200 opacity-100"
          aria-label={
            popup.kind === "message"
              ? "Open chat"
              : popup.kind === "deposit_new"
                ? "Open deposits"
                : "Open game request"
          }
        >
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-purple-600 to-orange-500 flex items-center justify-center shrink-0">
            {popupIcon(popup)}
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <p className="text-sm font-semibold text-white truncate">{popup.title}</p>
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{popup.preview}</p>
            <p className="text-[10px] text-orange-400 mt-1.5 font-medium">{popupActionLabel(popup)}</p>
          </div>
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              setPopup(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                setPopup(null);
              }
            }}
            className="p-1 rounded-lg hover:bg-white/10 text-muted-foreground shrink-0"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </span>
        </button>
      )}
    </MessageRealtimeContext.Provider>
  );
}
