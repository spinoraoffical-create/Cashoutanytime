import "server-only";

import { createClient } from "@/lib/supabase/server";

export type PublicPromotion = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  image_url: string | null;
  badge_text: string | null;
  code: string | null;
  is_featured: boolean;
  starts_at: string | null;
  ends_at: string | null;
};

export async function getActivePromotions(): Promise<PublicPromotion[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("promotions")
    .select(
      "id, slug, title, summary, description, image_url, badge_text, code, is_featured, starts_at, ends_at"
    )
    .eq("status", "active")
    .order("priority", { ascending: true });

  const now = Date.now();
  return (data ?? []).filter((p) => {
    const starts = p.starts_at ? new Date(p.starts_at).getTime() : 0;
    const ends = p.ends_at ? new Date(p.ends_at).getTime() : Infinity;
    return starts <= now && ends > now;
  });
}
