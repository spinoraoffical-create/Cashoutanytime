import type { MetadataRoute } from "next";

import { PUBLIC_ROUTES, SITE_URL } from "@/lib/constants";
import { getPublishedBlogPosts, allGeoCityParams, allGeoStateSlugs, getGames } from "@/lib/data/marketing";
import { getGameBySlug } from "@/lib/games";
import { getGameSitemapPriority } from "@/lib/seo/game-seo";

export type IndexableUrl = MetadataRoute.Sitemap[number];

/** Public pages search engines should crawl. Private account pages stay out. */
export async function listIndexableUrls(): Promise<IndexableUrl[]> {
  const staticRoutes: IndexableUrl[] = PUBLIC_ROUTES.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    lastModified: new Date(),
    changeFrequency: route.path === "/" ? "daily" : "weekly",
    priority: route.priority,
  }));

  const gameRoutes: IndexableUrl[] = (await getGames()).flatMap((row) => {
    const game = getGameBySlug(row.slug);
    if (!game || game.upcoming) return [];
    return [
      {
        url: `${SITE_URL}/games/${game.slug}`,
        lastModified: new Date(),
        changeFrequency: "weekly" as const,
        priority: getGameSitemapPriority(game),
      },
    ];
  });

  const posts = await getPublishedBlogPosts();
  const blogRoutes: IndexableUrl[] = posts
    .filter((post) => post.slug)
    .map((post) => ({
      url: `${SITE_URL}/blog/${post.slug}`,
      lastModified: post.published_at ? new Date(post.published_at) : new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

  const stateRoutes: IndexableUrl[] = (await allGeoStateSlugs()).map((slug) => ({
    url: `${SITE_URL}/${slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.75,
  }));

  const cityRoutes: IndexableUrl[] = (await allGeoCityParams()).map(({ state, city }) => ({
    url: `${SITE_URL}/${state}/${city}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  const seen = new Set<string>();
  return [...staticRoutes, ...gameRoutes, ...blogRoutes, ...stateRoutes, ...cityRoutes].filter((row) => {
    if (seen.has(row.url)) return false;
    seen.add(row.url);
    return true;
  });
}
