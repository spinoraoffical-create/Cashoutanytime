import { NextResponse } from "next/server";

import { verifyCronRequest } from "@/lib/cron/auth";
import { listIndexableUrls } from "@/lib/seo/indexable-urls";
import { submitIndexNow } from "@/lib/seo/indexnow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Tell Bing, Yandex, and other IndexNow engines about the current public pages. */
export async function GET(request: Request) {
  const denied = verifyCronRequest(request);
  if (denied) return denied;

  const pages = await listIndexableUrls();
  const result = await submitIndexNow(pages.map((page) => page.url));
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
