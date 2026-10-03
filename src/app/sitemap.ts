import type { MetadataRoute } from "next";
import { SITE_URL, PUBLIC_ROUTES } from "@/lib/constants";
import { GAMES } from "@/lib/games";
import { getGameSitemapPriority } from "@/lib/seo/game-seo";
import { ALL_BLOG_SLUGS, allGeoCityParams, allGeoStateSlugs } from "@/lib/data/marketing";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes = PUBLIC_ROUTES.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    lastModified: new Date(),
    changeFrequency: route.path === "/" ? ("daily" as const) : ("weekly" as const),
    priority: route.priority,
  }));

  const gameRoutes = GAMES.filter((g) => !g.upcoming).map((game) => ({
    url: `${SITE_URL}/games/${game.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: getGameSitemapPriority(game),
  }));

  const blogRoutes: MetadataRoute.Sitemap = ALL_BLOG_SLUGS.map((slug) => ({
    url: `${SITE_URL}/blog/${slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const stateRoutes: MetadataRoute.Sitemap = (await allGeoStateSlugs()).map((slug) => ({
    url: `${SITE_URL}/${slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.75,
  }));

  const cityRoutes: MetadataRoute.Sitemap = (await allGeoCityParams()).map(({ state, city }) => ({
    url: `${SITE_URL}/${state}/${city}`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [...staticRoutes, ...gameRoutes, ...blogRoutes, ...stateRoutes, ...cityRoutes];
}
