"use server";

import { revalidatePath } from "next/cache";
import { generateAndSaveAIBlogPost } from "@/lib/ai/blog-generator";
import { getBlogSettings, getTelegramSettings } from "@/lib/ai/settings";
import { authorize } from "@/lib/actions/admin/core";
import { broadcastBlogPostToTelegram } from "@/lib/telegram/auto-post";

export async function generateBlogArticleAction(topic?: string, keywords?: string[]) {
  const auth = await authorize("cms.manage");
  if ("error" in auth) return { ok: false as const, error: auth.error };

  try {
    const result = await generateAndSaveAIBlogPost({ topic, targetKeywords: keywords });
    if (!result.ok || !result.post) {
      return { ok: false as const, error: result.error || "Failed to generate blog article." };
    }

    const [blogSettings, telegramSettings] = await Promise.all([
      getBlogSettings(),
      getTelegramSettings(),
    ]);

    let telegramOk = false;
    if (blogSettings.auto_telegram_broadcast && telegramSettings.auto_post_blog) {
      const tg = await broadcastBlogPostToTelegram(result.post, {
        header: telegramSettings.template_header,
        footer: telegramSettings.template_footer,
      });
      telegramOk = tg.ok;
      if (tg.ok && result.postId) {
        const { createAdminClient } = await import("@/lib/supabase/admin");
        const db = createAdminClient();
        if (db) {
          await db.from("blog_posts").update({ telegram_sent: true }).eq("id", result.postId);
        }
      }
    }

    revalidatePath("/admin/ai-blog");
    revalidatePath("/admin/cms");
    revalidatePath("/blog");

    return {
      ok: true as const,
      post: result.post,
      postId: result.postId,
      telegramBroadcast: telegramOk,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unexpected error during blog generation";
    return { ok: false as const, error: msg };
  }
}
