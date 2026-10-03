import { NextResponse } from "next/server";
import { fetchBotLiveStatuses } from "@/lib/data/bot-worker-status";

export async function GET() {
  try {
    const bots = await fetchBotLiveStatuses();
    const onlineCount = bots.filter((b) => b.status !== "offline" && b.status !== "unknown").length;
    return NextResponse.json({
      ok: true,
      onlineCount,
      total: bots.length,
      bots,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch bot status";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
