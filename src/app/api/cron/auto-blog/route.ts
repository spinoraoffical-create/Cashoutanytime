import { NextResponse } from "next/server";
import { generateAndSaveAIBlogPost } from "@/lib/ai/blog-generator";
import { broadcastBlogPostToTelegram } from "@/lib/telegram/auto-post";
import { verifyCronRequest } from "@/lib/cron/auth";
import { getBlogSettings, getTelegramSettings } from "@/lib/ai/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: Request) {
  return handleCron(request);
}

export async function POST(request: Request) {
  return handleCron(request);
}

async function handleCron(request: Request) {
  const denied = verifyCronRequest(request);
  if (denied) return denied;

  const blogSettings = await getBlogSettings();
  if (!blogSettings.is_enabled) {
    return NextResponse.json({ skipped: true, reason: "AI blog disabled in settings" });
  }

  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "true";

  if (!force && blogSettings.last_generated_at && blogSettings.posting_frequency_hours) {
    const lastGenTime = new Date(blogSettings.last_generated_at).getTime();
    if (!isNaN(lastGenTime) && lastGenTime > 0) {
      const elapsedMs = Date.now() - lastGenTime;
      const requiredMs = blogSettings.posting_frequency_hours * 60 * 60 * 1000;
      if (elapsedMs < requiredMs) {
        const remainingMinutes = Math.ceil((requiredMs - elapsedMs) / (60 * 1000));
        return NextResponse.json({
          skipped: true,
          reason: `Posting frequency limit not reached. Last generated: ${blogSettings.last_generated_at}. Posting frequency: every ${blogSettings.posting_frequency_hours} hours. Remaining: ${remainingMinutes} minutes. Pass ?force=true to override.`,
        });
      }
    }
  }

  const topicParam = url.searchParams.get("topic") || undefined;
  const keywordsParam = url.searchParams.get("keywords")
    ? url.searchParams.get("keywords")!.split(",")
    : undefined;

  const result = await generateAndSaveAIBlogPost({
    topic: topicParam,
    targetKeywords: keywordsParam,
    aiProvider: blogSettings.ai_provider as "smart_auto",
    aiModel: blogSettings.ai_model,
  });

  if (!result.ok || !result.post) {
    return NextResponse.json(
      { error: result.error || "Failed to generate AI blog post" },
      { status: 500 }
    );
  }

  let telegramResult: { ok: boolean; error?: string } = { ok: false };
  const telegramSettings = await getTelegramSettings();

  if (blogSettings.auto_telegram_broadcast && telegramSettings.auto_post_blog) {
    try {
      telegramResult = await broadcastBlogPostToTelegram(result.post, {
        header: telegramSettings.template_header,
        footer: telegramSettings.template_footer,
      });
      if (telegramResult.ok && result.postId) {
        const { createAdminClient } = await import("@/lib/supabase/admin");
        const db = createAdminClient();
        if (db) {
          await db.from("blog_posts").update({ telegram_sent: true }).eq("id", result.postId);
        }
      }
    } catch (err) {
      telegramResult = {
        ok: false,
        error: err instanceof Error ? err.message : "Broadcast failed",
      };
    }
  }

  return NextResponse.json({
    success: true,
    post: {
      id: result.postId,
      title: result.post.title,
      slug: result.post.slug,
    },
    telegramBroadcast: telegramResult,
  });
}
