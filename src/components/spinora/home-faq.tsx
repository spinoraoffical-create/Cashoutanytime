import Link from "next/link";
import { ChevronDown } from "lucide-react";

import { JsonLd } from "@/lib/seo/json-ld";
import type { MarketingFaq } from "@/lib/data/marketing";

export function HomeFaq({
  faqs,
  limit = 6,
  showAllLink = true,
}: {
  faqs: MarketingFaq[];
  limit?: number;
  showAllLink?: boolean;
}) {
  if (!faqs.length) return null;
  const items = faqs.slice(0, limit);

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };

  return (
    <section aria-labelledby="faq-heading" className="mx-auto max-w-3xl scroll-mt-24 px-4 sm:px-6">
      <JsonLd data={faqSchema} />
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="hud-label text-ws-gold-deep dark:text-ws-gold">FAQ</p>
          <h2 id="faq-heading" className="mt-1 text-3xl font-bold sm:text-4xl">
            Frequently asked questions
          </h2>
        </div>
        {showAllLink && (
          <Link
            href="/support"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-foreground/5 px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:border-ws-green/40"
          >
            All questions
          </Link>
        )}
      </div>

      <div className="space-y-3">
        {items.map((f, i) => (
          <details
            key={f.question}
            open={i === 0}
            className="group rounded-2xl border border-border bg-card"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 text-sm font-semibold text-foreground">
              {f.question}
              <ChevronDown
                className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                aria-hidden
              />
            </summary>
            <p className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground">{f.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
