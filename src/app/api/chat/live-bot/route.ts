import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { clientIp, rateLimit } from "@/lib/api/rate-limit";

export async function POST(req: Request) {
  const limited = await rateLimit(`live-bot:${clientIp(req)}`, 30, 60_000);
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
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!message.trim() && !hasMedia) {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    return NextResponse.json({ success: true, reply: null, alertedTelegram: false });
  } catch (err) {
    console.error("[live-bot]", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "Support is temporarily unavailable. Please try again later." },
      { status: 500 }
    );
  }
}
