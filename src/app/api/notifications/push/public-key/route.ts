import { NextResponse } from "next/server";

export function GET() {
  const key = process.env.VAPID_PUBLIC_KEY?.trim();
  if (!key) {
    return NextResponse.json({ error: "Phone notifications are not configured yet." }, { status: 503 });
  }
  return NextResponse.json({ publicKey: key });
}
