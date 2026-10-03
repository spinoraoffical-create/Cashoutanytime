import { NextResponse } from "next/server";
import { isAuthError, requireStaffApi } from "@/lib/api/admin-auth";
import { getAutopilotStatus, toggleAutopilot, runAutopilotDailyPostNow } from "@/lib/telegram/autopilot-worker";

export async function GET() {
  const auth = await requireStaffApi("cms.manage");
  if (isAuthError(auth)) return auth;
  const status = await getAutopilotStatus();
  return NextResponse.json(status);
}

export async function POST(req: Request) {
  const auth = await requireStaffApi("cms.manage");
  if (isAuthError(auth)) return auth;

  try {
    const { action, enable } = await req.json();

    if (action === "toggle") {
      const status = await toggleAutopilot(enable);
      return NextResponse.json({ ok: true, status });
    }

    if (action === "trigger") {
      const result = await runAutopilotDailyPostNow();
      return NextResponse.json(result);
    }

    const status = await getAutopilotStatus();
    return NextResponse.json({ ok: true, status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
