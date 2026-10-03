import { NextResponse } from "next/server";
import { runSystemSelfAnalysis } from "@/lib/ai/self-analyzer";
import { sendTelegramMessage } from "@/lib/telegram/client";
import { verifyCronRequest } from "@/lib/cron/auth";

export async function GET(request: Request) {
  return handleCron(request);
}

export async function POST(request: Request) {
  return handleCron(request);
}

async function handleCron(request: Request) {
  const denied = verifyCronRequest(request);
  if (denied) return denied;

  const report = await runSystemSelfAnalysis();

  if (report.healthScore < 90) {
    const alertMsg = `
⚡ <b>SPINORA AI HEALTH REPORT</b> ⚡

<b>Health Score:</b> ${report.healthScore}/100
<b>Published SEO Posts:</b> ${report.seoMetrics.publishedPostsCount}
<b>Geo Pages:</b> ${report.seoMetrics.geoPagesCount}
<b>Total Users:</b> ${report.activityMetrics.totalUsers}

🔍 <b>Recommendations:</b>
${report.recommendations.map((r) => `• <b>${r.title}:</b> ${r.description}`).join("\n")}
`.trim();

    void sendTelegramMessage(alertMsg, { channel: "admin" });
  }

  return NextResponse.json({ success: true, report });
}
