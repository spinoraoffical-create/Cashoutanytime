import { sendTelegramPhoto, sendTelegramMessage, escapeTelegramHtml } from "@/lib/telegram/client";
import { GeneratedBlogPost } from "@/lib/ai/blog-generator";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://spinoracasinos.com";

export interface TelegramBroadcastOptions {
  header?: string;
  footer?: string;
  channel?: "admin" | "promo";
}

/** Formats a blog post into a high-converting Telegram broadcast message */
export function formatBlogTelegramMessage(
  post: GeneratedBlogPost,
  options?: TelegramBroadcastOptions
): string {
  const header = options?.header || "🔥 <b>SPINORA AI GAMING UPDATE</b> 🔥";
  const footer = options?.footer || "👉 Join Spinora & Claim Exclusive Bonus Credits! 🚀";

  const postLink = `${SITE_URL}/blog/${post.slug}`;


  const keywordsTag = post.seo_keywords
    .slice(0, 3)
    .map((k) => `#${k.replace(/[^a-zA-Z0-9]/g, "")}`)
    .join(" ");

  return `
${header}

<b>${escapeTelegramHtml(post.title)}</b>

${escapeTelegramHtml(post.excerpt)}

⏱ <i>Reading Time: ${post.reading_time_minutes} min</i>

📖 <b>Read full article:</b>
${postLink}

${footer}

${keywordsTag} #Spinora #Gaming #OnlineCasino
`.trim();
}

/** Sends a blog post broadcast to Telegram channel */
export async function broadcastBlogPostToTelegram(
  post: GeneratedBlogPost,
  options?: TelegramBroadcastOptions
): Promise<{ ok: boolean; error?: string }> {
  const messageText = formatBlogTelegramMessage(post, options);

  if (post.cover_image) {
    const isAbsolute = post.cover_image.startsWith("http://") || post.cover_image.startsWith("https://");
    const photoUrl = isAbsolute ? post.cover_image : `${SITE_URL}${post.cover_image}`;
    const photoResult = await sendTelegramPhoto(photoUrl, messageText, {
      channel: options?.channel || "promo",
    });
    if (photoResult.ok) return { ok: true };
  }

  // Fallback to text message if photo send fails or image unavailable
  return await sendTelegramMessage(messageText, { channel: options?.channel || "promo" });
}

/** Send custom promo alert to Telegram */
export async function broadcastPromoToTelegram(
  title: string,
  description: string,
  promoUrl?: string
): Promise<{ ok: boolean; error?: string }> {
  const link = promoUrl || `${SITE_URL}/promotions`;


  const text = `
🎉 <b>SPECIAL SPINORA PROMOTION</b> 🎉

<b>${escapeTelegramHtml(title)}</b>

${escapeTelegramHtml(description)}

🎁 <b>Claim Your Bonus Here:</b>
${link}

#SpinoraPromos #CasinoBonus #FreeCredits
`.trim();

  return await sendTelegramMessage(text, { channel: "promo" });
}
