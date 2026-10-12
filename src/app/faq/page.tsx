import Link from "next/link";
import { VipPageLayout } from "@/components/layout/vip-page-layout";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { faqMetadata } from "@/lib/seo/metadata";
import { HOME_FAQS } from "@/lib/seo/faq-data";

export const metadata = faqMetadata;

export default function FaqPage() {
  return (
    <VipPageLayout>
      <main className="mx-auto w-full max-w-3xl px-4 pb-16">
        <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "FAQ" }]} />
        <h1 className="text-4xl font-bold">Sweepstakes Hub FAQ</h1>
        <p className="mt-3 text-muted-foreground">
          Short answers about sweeptakehub.com, Game Rooms, sign-up, and cash outs.
        </p>
        <div className="mt-8 space-y-4">
          {HOME_FAQS.map((faq) => (
            <article key={faq.q} className="rounded-2xl border border-white/10 p-5">
              <h2 className="text-lg font-semibold">{faq.q}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{faq.a}</p>
            </article>
          ))}
        </div>
        <p className="mt-8 text-sm text-muted-foreground">
          More account help is on <Link href="/help" className="text-primary hover:underline">Help</Link>. To reach a person, open{" "}
          <Link href="/support" className="text-primary hover:underline">Support</Link>.
        </p>
      </main>
    </VipPageLayout>
  );
}
