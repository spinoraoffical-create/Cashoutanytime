import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GeoPageTemplate } from "@/components/marketing/geo-page-template";
import { allGeoStateSlugs, getGeoState } from "@/lib/data/marketing";
import { withPageSocial } from "@/lib/seo/metadata";

export const revalidate = 86400;
export const dynamicParams = false;

const RESERVED = new Set([
  "admin",
  "api",
  "auth",
  "blog",
  "contact",
  "dashboard",
  "games",
  "leaderboard",
  "login",
  "privacy",
  "promotions",
  "register",
  "reset-password",
  "robots.txt",
  "sitemap.xml",
  "spin",
  "support",
  "terms",
  "vip",
  "about",
  "faq",
  "feed.xml",
  "get-app",
  "help",
  "llms-full.txt",
  "llms.txt",
  "play",
  "whats-new",
]);

export async function generateStaticParams() {
  return (await allGeoStateSlugs()).map((state) => ({ state }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ state: string }>;
}): Promise<Metadata> {
  const { state: stateSlug } = await params;
  if (RESERVED.has(stateSlug)) return {};
  const state = await getGeoState(stateSlug);
  if (!state) return { robots: { index: false, follow: false } };

  const title = `${state.name} | Sweepstakes Hub`;
  return {
    ...withPageSocial({
      title,
      description: state.metaDescription,
      path: `/${stateSlug}`,
    }),
    robots: { index: false, follow: false },
  };
}

export default async function StatePage({
  params,
}: {
  params: Promise<{ state: string }>;
}) {
  const { state: stateSlug } = await params;
  if (RESERVED.has(stateSlug)) notFound();
  const state = await getGeoState(stateSlug);
  if (!state) notFound();

  return <GeoPageTemplate state={state} />;
}
