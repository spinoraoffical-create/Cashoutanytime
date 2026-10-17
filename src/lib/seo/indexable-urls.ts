import type { MetadataRoute } from "next";

import { PUBLIC_ROUTES, SITE_URL } from "@/lib/constants";
import { getPublishedBlogPosts, allGeoCityParams, allGeoStateSlugs, getGames } from "@/lib/data/marketing";
import { getGameBySlug } from "@/lib/games";
import { getGameSitemapPriority } from "@/lib/seo/game-seo";
import { isPublicIndexablePath } from "@/lib/seo/sitemap-policy";

export type IndexableUrl = MetadataRoute.Sitemap[number];

/** Public pages search engines should crawl. Private account pages stay out. */
export async function listIndexableUrls(): Promise<IndexableUrl[]> {
  const staticRoutes: IndexableUrl[] = PUBLIC_ROUTES.filter((route) => isPublicIndexablePath(route.path)).map(
    (route) => ({
      url: `${SITE_URL}${route.path}`,
      changeFrequency: route.path === "/" ? "daily" : "weekly",
      priority: route.priority,
    })
  );

  const gameRoutes: IndexableUrl[] = (await getGames()).flatMap((row) => {
    const game = getGameBySlug(row.slug);
    if (!game || game.upcoming) return [];
    return [
      {
        url: `${SITE_URL}/games/${game.slug}`,
        changeFrequency: "weekly" as const,
        priority: getGameSitemapPriority(game),
      },
    ];
  });

  const posts = await getPublishedBlogPosts();
  const blogRoutes: IndexableUrl[] = posts
    .filter((post) => post.slug && isPublicIndexablePath(`/blog/${post.slug}`))
    .map((post) => {
      const published = post.published_at ? new Date(post.published_at) : null;
      return {
        url: `${SITE_URL}/blog/${post.slug}`,
        ...(published && !Number.isNaN(published.getTime()) ? { lastModified: published } : {}),
        changeFrequency: "weekly" as const,
        priority: 0.7,
      };
    });

  const stateRoutes: IndexableUrl[] = (await allGeoStateSlugs())
    .filter((slug) => isPublicIndexablePath(`/${slug}`))
    .map((slug) => ({
      url: `${SITE_URL}/${slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.75,
    }));

  const cityRoutes: IndexableUrl[] = (await allGeoCityParams())
    .filter(({ state, city }) => isPublicIndexablePath(`/${state}/${city}`))
    .map(({ state, city }) => ({
      url: `${SITE_URL}/${state}/${city}`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    }));

  const seen = new Set<string>();
  return [...staticRoutes, ...gameRoutes, ...blogRoutes, ...stateRoutes, ...cityRoutes].filter((row) => {
    if (!isPublicIndexablePath(new URL(row.url).pathname)) return false;
    if (seen.has(row.url)) return false;
    seen.add(row.url);
    return true;
  });
}
