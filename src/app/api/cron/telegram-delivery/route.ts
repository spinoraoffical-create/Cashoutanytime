import { NextResponse } from "next/server";

import { verifyCronRequest } from "@/lib/cron/auth";
import { processTelegramDeliveryQueue } from "@/lib/telegram/control/delivery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  const denied = verifyCronRequest(request);
  if (denied) return denied;
  const result = await processTelegramDeliveryQueue();
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  return GET(request);
}
