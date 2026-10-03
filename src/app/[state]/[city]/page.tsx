import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GeoPageTemplate } from "@/components/marketing/geo-page-template";
import { allGeoCityParams, getGeoCity } from "@/lib/data/marketing";

export const revalidate = 86400;
export const dynamicParams = true;

export async function generateStaticParams() {
  return await allGeoCityParams();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ state: string; city: string }>;
}): Promise<Metadata> {
  const { state: stateSlug, city: citySlug } = await params;
  const city = await getGeoCity(stateSlug, citySlug);
  if (!city) return {};

  const title = `Fish Table Games in ${city.name} | Spinora`;
  return {
    title,
    description: city.descriptionSnippet,
    alternates: { canonical: `/${stateSlug}/${citySlug}` },
  };
}

export default async function CityPage({
  params,
}: {
  params: Promise<{ state: string; city: string }>;
}) {
  const { state: stateSlug, city: citySlug } = await params;
  const city = await getGeoCity(stateSlug, citySlug);
  if (!city) notFound();

  const { getGeoState } = await import("@/lib/data/marketing");
  const state = await getGeoState(stateSlug);
  if (!state) notFound();

  return <GeoPageTemplate state={state} city={city} />;
}
