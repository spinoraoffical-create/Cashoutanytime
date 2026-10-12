import type { MetadataRoute } from "next";

import { listIndexableUrls } from "@/lib/seo/indexable-urls";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return listIndexableUrls();
}
