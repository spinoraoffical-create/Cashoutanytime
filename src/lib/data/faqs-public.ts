import "server-only";

import { createClient } from "@/lib/supabase/server";
import { HOME_FAQS } from "@/lib/seo/faq-data";

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

export type PublicFaqItem = { q: string; a: string };

/** Published CMS FAQs. The hardcoded list is used only when the query returns nothing. */
export async function getPublicFaqItems(): Promise<PublicFaqItem[]> {
  const published = await getPublishedFaqs();
  if (published.length === 0) {
    return HOME_FAQS.map((faq) => ({ q: faq.q, a: faq.a }));
  }
  return published.map((faq) => ({ q: faq.question, a: faq.answer }));
}
