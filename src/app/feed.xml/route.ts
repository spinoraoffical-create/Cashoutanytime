import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { getPublishedBlogPosts } from "@/lib/data/marketing";

export const revalidate = 3600;

function xml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET() {
  const posts = await getPublishedBlogPosts();
  const items = posts
    .filter((post) => post.slug && post.title)
    .map((post) => {
      const link = `${SITE_URL}/blog/${post.slug}`;
      const when = post.published_at ? new Date(post.published_at).toUTCString() : new Date().toUTCString();
      const summary = post.seo_description || post.excerpt || post.title;
      return `<item>
        <title>${xml(post.seo_title || post.title)}</title>
        <link>${xml(link)}</link>
        <guid>${xml(link)}</guid>
        <pubDate>${xml(when)}</pubDate>
        <description>${xml(summary)}</description>
      </item>`;
    })
    .join("");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${xml(SITE_NAME)}</title>
    <link>${xml(SITE_URL)}</link>
    <description>${xml("Game guides and updates from Sweepstakes Hub.")}</description>
    ${items}
  </channel>
</rss>`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
