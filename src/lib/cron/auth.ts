import { NextResponse } from "next/server";

/** Fail closed: every cron route requires CRON_SECRET (Bearer header only). */
export function verifyCronRequest(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    console.error("[cron] CRON_SECRET is not configured");
    return NextResponse.json({ error: "Cron not configured" }, { status: 503 });
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
