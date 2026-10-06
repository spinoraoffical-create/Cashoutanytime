import { NextRequest, NextResponse } from "next/server";

import { processCampaignBatch } from "@/lib/actions/admin/newsletters";
import { verifyCronRequest } from "@/lib/cron/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Externally triggered (cron-job.org) — sweeps scheduled/sending newsletter campaigns. */
export async function GET(request: NextRequest) {
  const denied = verifyCronRequest(request);
  if (denied) return denied;

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const { data: due } = await admin
    .from("newsletter_campaigns")
    .select("id")
    .in("status", ["scheduled", "sending"])
    .lte("scheduled_at", new Date().toISOString());

  const results = [];
  for (const campaign of due ?? []) {
    const result = await processCampaignBatch(campaign.id);
    results.push({ id: campaign.id, ...result });
  }

  return NextResponse.json({
    ok: true,
    at: new Date().toISOString(),
    processed: results.length,
    results,
  });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
