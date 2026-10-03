import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processAIChatQuery, getBotSenderProfileId, stripHtmlForDisplay } from "@/lib/ai/chatbot";
import { getChatbotSettings } from "@/lib/ai/settings";
import { clientIp, rateLimit } from "@/lib/api/rate-limit";
import { isTelegramConfigured, sendTelegramMessage, escapeTelegramHtml } from "@/lib/telegram/client";
import { SITE_URL } from "@/lib/constants";

export async function POST(req: Request) {
  const limited = rateLimit(`live-bot:${clientIp(req)}`, 30, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please wait." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } }
    );
  }

  try {
    const body = await req.json();
    const message = String(body.message || "").slice(0, 2000);
    const hasMedia = Boolean(body.hasMedia);
    const mediaName = String(body.mediaName || "").slice(0, 200);
    const userId = body.userId ? String(body.userId) : undefined;

    if (!message.trim() && !hasMedia) {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }

    const settings = await getChatbotSettings();
    if (!settings.is_enabled) {
      return NextResponse.json({
        success: true,
        reply: "Support chat is temporarily offline. Please email support or try again later.",
        alertedTelegram: false,
      });
    }

    const query = hasMedia
      ? `[User uploaded media: ${mediaName || "file"}] ${message}`.trim()
      : message;

    const aiResult = await processAIChatQuery(query, undefined, userId);
    let reply = stripHtmlForDisplay(aiResult.response);

    if (hasMedia && aiResult.confidenceScore > 0.7) {
      reply =
        "Thank you for sending your receipt/media! I've alerted our support team on Telegram to review and credit your account.";
    }

    const needsHuman = aiResult.shouldEscalateToHuman || hasMedia;

    const admin = createAdminClient();
    const botSenderId = await getBotSenderProfileId();

    if (admin && userId && botSenderId) {
      try {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(userId)) {
          return NextResponse.json({ success: true, reply, alertedTelegram: needsHuman });
        }

        let { data: conv } = await admin
          .from("conversations")
          .select("id")
          .eq("user_id", userId)
          .eq("is_active", true)
          .maybeSingle();

        if (!conv) {
          const { data: newConv } = await admin
            .from("conversations")
            .insert({ user_id: userId, is_active: true })
            .select("id")
            .single();
          conv = newConv;
        }

        if (conv?.id) {
          await admin.from("messages").insert({
            conversation_id: conv.id,
            sender_id: userId,
            content: message || (hasMedia ? "Uploaded media file" : "User message"),
            is_read: false,
          });

          await admin.from("messages").insert({
            conversation_id: conv.id,
            sender_id: botSenderId,
            content: `🤖 ${reply}`,
            is_read: true,
          });

          await admin
            .from("conversations")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", conv.id);
        }
      } catch (dbErr) {
        console.warn("[live-bot] DB save warning:", dbErr);
      }
    }

    if (
      needsHuman &&
      settings.telegram_escalation_enabled &&
      isTelegramConfigured()
    ) {
      const alertText = [
        "🚨 <b>LIVE CASINO BOT ESCALATION</b> 🚨",
        "",
        `<b>Player:</b> ${escapeTelegramHtml(userId || "guest")}`,
        `<b>Question:</b> ${escapeTelegramHtml(message || (hasMedia ? "Uploaded media" : "Support needed"))}`,
        hasMedia ? `<b>File:</b> ${escapeTelegramHtml(mediaName || "attachment")}` : "",
        "",
        `<i>Review: ${SITE_URL}/admin/ai-bot</i>`,
      ]
        .filter(Boolean)
        .join("\n");

      await sendTelegramMessage(alertText);
    }

    return NextResponse.json({ success: true, reply, alertedTelegram: needsHuman });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
