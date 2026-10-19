import { NextResponse } from "next/server";

import { verifyCronRequest } from "@/lib/cron/auth";
import { processTelegramDeliveryQueue } from "@/lib/telegram/control/delivery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Hobby cron runs once a day. This route is the urgent path when an external worker calls it with CRON_SECRET.
// The worker must use a test or production secret for that environment only. It does not receive payment bodies.

export async function GET(request: Request) {
  const denied = verifyCronRequest(request);
  if (denied) return denied;
  const result = await processTelegramDeliveryQueue();
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  return GET(request);
}
