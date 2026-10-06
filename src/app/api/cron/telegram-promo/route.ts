import { NextRequest, NextResponse } from "next/server";

import { verifyCronRequest } from "@/lib/cron/auth";
import { runTelegramPromoBroadcast } from "@/lib/telegram/promo-broadcast";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Vercel Cron: POST/GET hourly — rotates through telegram_promo_messages pool. */
export async function GET(request: NextRequest) {
  const denied = verifyCronRequest(request);
  if (denied) return denied;

  try {
    const result = await runTelegramPromoBroadcast();
    const status = result.ok ? 200 : 500;
    return NextResponse.json(result, { status });
  } catch (err) {
    console.error("[cron] telegram-promo", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Promo run failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
