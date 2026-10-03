import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/actions/notifications";
import { notifyAdminOfCustomerMessage } from "@/lib/telegram/notify-admin-message";
import { processAIChatQuery, getBotSenderProfileId } from "@/lib/ai/chatbot";
import { getChatbotSettings } from "@/lib/ai/settings";
import { isTelegramConfigured, sendTelegramMessage, escapeTelegramHtml } from "@/lib/telegram/client";
import { SITE_URL } from "@/lib/constants";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: {
    conversationId?: string;
    content?: string;
    attachmentType?: "image" | "file" | null;
    kind?: "user" | "admin";
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { conversationId, content = "", attachmentType = null, kind } = body;
  if (!conversationId || !kind) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.role === "admin";

  if (kind === "admin") {
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { data: conversation } = await supabase
      .from("conversations")
      .select("user_id")
      .eq("id", conversationId)
      .single();

    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString(), admin_id: user.id })
      .eq("id", conversationId);

    if (conversation?.user_id) {
      const preview =
        content.trim() ||
        (attachmentType === "image"
          ? "Sent you an image"
          : attachmentType === "file"
            ? "Sent you a file"
            : "Sent you a message");
      await createNotification(
        conversation.user_id,
        "New message from Support",
        preview.length > 140 ? `${preview.slice(0, 137)}...` : preview,
        "info"
      );
    }
  } else {
    const { data: conversation } = await supabase
      .from("conversations")
      .select("user_id")
      .eq("id", conversationId)
      .single();

    if (!conversation || conversation.user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const adminClient = createAdminClient();
    const bumpClient = adminClient ?? supabase;
    await bumpClient
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);

    void notifyAdminOfCustomerMessage({
      conversationId,
      senderId: user.id,
      content,
      attachmentType,
    });

    const chatSettings = await getChatbotSettings();

    if (content.trim() && chatSettings.is_enabled && chatSettings.auto_reply_enabled) {
      void (async () => {
        try {
          const aiResult = await processAIChatQuery(content, conversationId, user.id);
          const botSenderId = await getBotSenderProfileId();
          const db = adminClient ?? supabase;

          if (aiResult.shouldEscalateToHuman && chatSettings.telegram_escalation_enabled && isTelegramConfigured()) {
            const { data: profile } = await db
              .from("profiles")
              .select("display_name, username, email")
              .eq("id", user.id)
              .maybeSingle();

            const displayName = profile?.display_name || profile?.username || "Player";
            const email = profile?.email || "No Email";

            await sendTelegramMessage(
              [
                "🚨 <b>CHAT ESCALATION</b>",
                `<b>Player:</b> ${escapeTelegramHtml(displayName)}`,
                `<b>Email:</b> ${escapeTelegramHtml(email)}`,
                `<b>Message:</b> ${escapeTelegramHtml(content.slice(0, 500))}`,
                `<i>${SITE_URL}/admin/chat</i>`,
              ].join("\n")
            );
            return;
          }

          if (aiResult.response && botSenderId) {
            await db.from("messages").insert({
              conversation_id: conversationId,
              sender_id: botSenderId,
              content: `🤖 ${aiResult.response}`,
              is_read: false,
            });
          }
        } catch (err) {
          console.error("[AfterSend AI Auto-Reply Error]:", err);
        }
      })();
    }
  }

  return NextResponse.json({ ok: true });
}
