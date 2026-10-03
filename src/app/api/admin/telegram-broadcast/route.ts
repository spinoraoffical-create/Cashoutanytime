import { NextResponse } from "next/server";
import { isAuthError, requireStaffApi } from "@/lib/api/admin-auth";
import { sendTelegramPhoto, sendTelegramMessage } from "@/lib/telegram/client";
import { broadcastPromoToTelegram } from "@/lib/telegram/auto-post";
import { SITE_URL } from "@/lib/constants";

export async function POST(req: Request) {
  const auth = await requireStaffApi("cms.manage");
  if (isAuthError(auth)) return auth;

  try {
    const { message, imageUrl, channel } = await req.json();

    if (imageUrl && message) {
      const photo = String(imageUrl).startsWith("http")
        ? String(imageUrl)
        : `${SITE_URL}${String(imageUrl)}`;
      const result = await sendTelegramPhoto(photo, String(message), {
        channel: channel === "admin" ? "admin" : "promo",
      });
      if (!result.ok) {
        return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
      }
      return NextResponse.json({ ok: true, message: "Broadcast sent with photo." });
    }

    if (message?.trim()) {
      const result = await sendTelegramMessage(String(message).trim(), {
        channel: channel === "admin" ? "admin" : "promo",
      });
      if (!result.ok) {
        return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
      }
      return NextResponse.json({ ok: true, message: "Broadcast sent." });
    }

    const result = await broadcastPromoToTelegram(
      "Spinora Promo Announcement",
      "Check your Spinora Dashboard for exclusive deposit matches and free wheel spins!"
    );
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
    }
    return NextResponse.json({ ok: true, message: "Default promo broadcast sent." });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to send Telegram message";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
