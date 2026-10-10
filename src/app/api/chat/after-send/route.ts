import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/actions/notifications";
import { notifyAdminOfCustomerMessage } from "@/lib/telegram/notify-admin-message";
import { processAIChatQuery, getBotSenderProfileId, stripHtmlForDisplay } from "@/lib/ai/chatbot";
import { asksForPerson, CHAT_FALLBACK_REPLY, CHAT_PERSON_REPLY, supportGreetingReply } from "@/lib/ai/escalate";
import { scriptedSupportReply } from "@/lib/chat/support-auto-reply";
import { supportReferenceCode } from "@/lib/chat/support-thread";
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
    const queue = await readHumanQueue(db, conversationId);
    const wantsPerson = asksForPerson(content);
    if (wantsPerson && !queue.queued && queue.columnsReady) {
      await db
        .from("conversations")
        .update({
          human_requested_at: new Date().toISOString(),
          support_reference: supportReferenceCode(conversationId),
          updated_at: new Date().toISOString(),
        })
        .eq("id", conversationId);
    }

    const staffReply = await db
      .from("messages")
      .select("id")
      .eq("conversation_id", conversationId)
      .eq("from_staff", true)
      .limit(1);
    const staffIsTalking = !staffReply.error && (staffReply.data?.length ?? 0) > 0;

    if (content.trim() && !staffIsTalking) {
      let replyText = scriptedSupportReply(content, queue.queued);
      let escalate = wantsPerson;
      if (
        !replyText &&
        !queue.queued &&
        chatSettings.is_enabled &&
        chatSettings.auto_reply_enabled
      ) {
        try {
          const aiResult = await processAIChatQuery(content, conversationId, user.id);
          const plain = stripHtmlForDisplay(aiResult.response || "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();
          replyText = asksForPerson(content)
            ? CHAT_PERSON_REPLY
            : plain || supportGreetingReply(content) || CHAT_FALLBACK_REPLY;
          escalate = wantsPerson || aiResult.shouldEscalateToHuman;
        } catch (err) {
          console.error("[AfterSend AI Auto-Reply Error]:", err);
          replyText = supportGreetingReply(content) || CHAT_FALLBACK_REPLY;
        }
      }

      if (replyText) {
        const botSenderId = await getBotSenderProfileId(user.id);
        if (botSenderId && botSenderId !== user.id) {
          const { error: insertError } = await db.from("messages").insert({
            conversation_id: conversationId,
            sender_id: botSenderId,
            content: replyText,
            is_read: false,
          });
          if (insertError) console.error("[AfterSend AI insert]:", insertError.message);
        } else {
          console.error("[AfterSend AI insert]: support bot profile is missing");
        }
      }

      if (escalate && chatSettings.telegram_escalation_enabled && isTelegramConfigured()) {
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
    }
  }

  return NextResponse.json({ ok: true });
}

async function readHumanQueue(
  db: SupabaseClient,
  conversationId: string
): Promise<{ queued: boolean; columnsReady: boolean }> {
  const { data, error } = await db
    .from("conversations")
    .select("human_requested_at")
    .eq("id", conversationId)
    .limit(1);

  if (error) {
    const found = await db
      .from("messages")
      .select("content")
      .eq("conversation_id", conversationId)
      .ilike("content", "%will reply in this chat%")
      .limit(1);
    return { queued: Boolean(found.data?.length), columnsReady: false };
  }

  return {
    queued: Boolean(data?.[0]?.human_requested_at),
    columnsReady: true,
  };
}
