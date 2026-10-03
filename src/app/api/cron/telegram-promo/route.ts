import { NextRequest, NextResponse } from "next/server";

import { runTelegramPromoBroadcast } from "@/lib/telegram/promo-broadcast";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Vercel Cron: POST/GET hourly — rotates through telegram_promo_messages pool. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = request.headers.get("authorization");

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runTelegramPromoBroadcast();
  const status = result.ok ? 200 : 500;
  return NextResponse.json(result, { status });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
