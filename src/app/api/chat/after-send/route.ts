import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/actions/notifications";
import { notifyAdminOfCustomerMessage } from "@/lib/telegram/notify-admin-message";
import { processAIChatQuery, getBotSenderProfileId, stripHtmlForDisplay } from "@/lib/ai/chatbot";
import { asksForPerson, CHAT_FALLBACK_REPLY, CHAT_PERSON_REPLY } from "@/lib/ai/escalate";
import { getChatbotSettings } from "@/lib/ai/settings";
import { isTelegramConfigured, sendTelegramMessage, escapeTelegramHtml } from "@/lib/telegram/client";
import { SITE_URL } from "@/lib/constants";
import { getStaffContext } from "@/lib/data/admin";

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

  const staff = await getStaffContext();

  if (kind === "admin") {
    if (!staff) {
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
    const adminClient = createAdminClient();
    const db = adminClient ?? supabase;
    const { data: ownedRows } = await db
      .from("conversations")
      .select("user_id")
      .eq("id", conversationId)
      .limit(1);
    const conversation = (ownedRows as { user_id: string }[] | null)?.[0];

    if (!conversation || conversation.user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await db
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
      try {
        const aiResult = await processAIChatQuery(content, conversationId, user.id);
        const botSenderId = await getBotSenderProfileId();
        if (!botSenderId || botSenderId === user.id) {
          return NextResponse.json({ error: "Support reply could not be saved." }, { status: 500 });
        }

        const plain = stripHtmlForDisplay(aiResult.response || "");
        const replyText = (
          asksForPerson(content) ? CHAT_PERSON_REPLY : plain || CHAT_FALLBACK_REPLY
        ).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

        const { error: insertError } = await db.from("messages").insert({
          conversation_id: conversationId,
          sender_id: botSenderId,
          content: replyText || CHAT_FALLBACK_REPLY,
          is_read: false,
        });
        if (insertError) {
          console.error("[AfterSend AI insert]:", insertError.message);
          return NextResponse.json({ error: "Support reply could not be saved." }, { status: 500 });
        }

        if (
          aiResult.shouldEscalateToHuman &&
          chatSettings.telegram_escalation_enabled &&
          isTelegramConfigured()
        ) {
          const { data: profileRows } = await db
            .from("profiles")
            .select("full_name, email")
            .eq("id", user.id)
            .limit(1);
          const profile = (profileRows as { full_name: string | null; email: string | null }[] | null)?.[0];
          const displayName = profile?.full_name || "Player";
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
        }
      } catch (err) {
        console.error("[AfterSend AI Auto-Reply Error]:", err);
        return NextResponse.json({ error: "Support reply could not be saved." }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
