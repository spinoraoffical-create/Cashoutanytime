import { NextResponse } from "next/server";
import { getGameWorkerStatus, toggleGameWorker, processPendingGameWorkerQueue } from "@/lib/game-automation/game-worker-engine";

export async function GET() {
  const status = getGameWorkerStatus();
  return NextResponse.json(status);
}

export async function POST(req: Request) {
  try {
    const { action, enable } = await req.json();

    if (action === "toggle") {
      const status = toggleGameWorker(enable);
      return NextResponse.json({ ok: true, status });
    }

    if (action === "process") {
      const result = await processPendingGameWorkerQueue();
      return NextResponse.json(result);
    }

    return NextResponse.json({ ok: true, status: getGameWorkerStatus() });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
