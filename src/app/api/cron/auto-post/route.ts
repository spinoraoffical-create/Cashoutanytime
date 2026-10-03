import { NextResponse } from "next/server";
import { runAutopilotDailyPostNow } from "@/lib/telegram/autopilot-worker";
import { processPendingGameWorkerQueue } from "@/lib/game-automation/game-worker-engine";
import { verifyCronRequest } from "@/lib/cron/auth";

export const revalidate = 0;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = verifyCronRequest(req);
  if (denied) return denied;

  try {
    const autopilotResult = await runAutopilotDailyPostNow();
    const workerResult = await processPendingGameWorkerQueue();

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      autopilot: autopilotResult,
      gameWorker: workerResult,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cron daemon execution failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return GET(req);
}
