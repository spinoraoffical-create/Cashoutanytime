import type { Metadata } from "next";
import Link from "next/link";

import { VipPageLayout } from "@/components/layout/vip-page-layout";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";

export const metadata: Metadata = {
  title: "Terms of Service | Spinora",
  description: "Terms that govern your use of the Spinora platform.",
  alternates: { canonical: "/terms" },
};

const SECTIONS = [
  {
    heading: "Acceptance of these terms",
    body: "By creating a Spinora account or using any part of the platform, you agree to these Terms of Service and our Privacy Policy. We may update these terms from time to time; continued use after changes take effect constitutes acceptance.",
  },
  {
    heading: "Eligibility",
    body: "Spinora is available to individuals 18 years of age or older. One account per person. Accounts are personal and non-transferable.",
  },
  {
    heading: "Virtual rewards",
    body: "Coins, XP, VIP tiers, achievements and other in-platform items are virtual entitlements with no cash value unless explicitly stated in a promotion. Reward rules are shown alongside each stream.",
  },
  {
    heading: "Fair play",
    body: "Automation, multiple accounts, self-referrals, and exploitation of bugs are prohibited. We may suspend accounts that violate these rules.",
  },
  {
    heading: "Contact",
    body: "Questions about these terms: support@spinoracasinos.com or open a message from your dashboard.",
  },
];

export default function TermsPage() {
  return (
    <VipPageLayout>
      <main className="pb-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Terms of Service" }]} />
          <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
          <div className="space-y-8">
            {SECTIONS.map((s) => (
              <section key={s.heading}>
                <h2 className="text-xl font-semibold mb-3">{s.heading}</h2>
                <p className="text-muted-foreground leading-relaxed">{s.body}</p>
              </section>
            ))}
          </div>
          <p className="mt-12 text-sm text-muted-foreground">
            See also our <Link href="/privacy" className="text-orange-400 hover:underline">Privacy Policy</Link>.
          </p>
        </div>
      </main>
    </VipPageLayout>
  );
}
