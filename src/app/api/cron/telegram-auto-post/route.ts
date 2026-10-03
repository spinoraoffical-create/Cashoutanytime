import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { broadcastBlogPostToTelegram, broadcastPromoToTelegram } from "@/lib/telegram/auto-post";
import { verifyCronRequest } from "@/lib/cron/auth";
import { getTelegramSettings } from "@/lib/ai/settings";

export async function GET(request: Request) {
  return handleCron(request);
}

export async function POST(request: Request) {
  return handleCron(request);
}

async function handleCron(request: Request) {
  const denied = verifyCronRequest(request);
  if (denied) return denied;

  const telegramSettings = await getTelegramSettings();
  if (!telegramSettings.auto_post_blog) {
    return NextResponse.json({ skipped: true, reason: "Blog Telegram auto-post disabled" });
  }

  const db = createAdminClient();
  if (!db) {
    return NextResponse.json({ error: "Database client unavailable" }, { status: 500 });
  }

  const { data: latestPost } = await db
    .from("blog_posts")
    .select("*")
    .eq("status", "published")
    .eq("telegram_sent", false)
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestPost) {
    const result = await broadcastBlogPostToTelegram(
      {
        title: latestPost.title,
        slug: latestPost.slug,
        excerpt: latestPost.excerpt || latestPost.title,
        content: latestPost.content,
        seo_title: latestPost.seo_title || latestPost.title,
        seo_description: latestPost.seo_description || latestPost.title,
        seo_keywords: latestPost.tags?.length ? latestPost.tags : ["spinora"],
        cover_image: latestPost.cover_image_url || "",
        reading_time_minutes: 4,
        category: "Gaming",
        tags: latestPost.tags || ["Spinora"],
      },
      {
        header: telegramSettings.template_header,
        footer: telegramSettings.template_footer,
      }
    );

    if (result.ok) {
      await db.from("blog_posts").update({ telegram_sent: true }).eq("id", latestPost.id);
    }

    return NextResponse.json({
      success: true,
      broadcastType: "blog_post",
      postTitle: latestPost.title,
      telegramResult: result,
    });
  }

  if (!telegramSettings.auto_post_promos) {
    return NextResponse.json({ skipped: true, reason: "No blog post and promos disabled" });
  }

  const result = await broadcastPromoToTelegram(
    "Daily Deposit Bonus & Double Spin Rewards!",
    "Deposit today via USDT, Chime, PayPal, or Cash App to claim up to 100% bonus load!"
  );

  return NextResponse.json({ success: true, broadcastType: "promo", telegramResult: result });
}
