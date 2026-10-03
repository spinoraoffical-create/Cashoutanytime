import "server-only";

import { createClient } from "@/lib/supabase/server";

export type PublicFaq = {
  id: string;
  question: string;
  answer: string;
  category: string;
  sort_order: number;
};

export async function getPublishedFaqs(): Promise<PublicFaq[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("faqs")
    .select("id, question, answer, category, sort_order")
    .eq("is_published", true)
    .order("sort_order", { ascending: true });

  return data ?? [];
}
