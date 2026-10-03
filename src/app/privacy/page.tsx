import type { Metadata } from "next";
import Link from "next/link";

import { VipPageLayout } from "@/components/layout/vip-page-layout";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";

export const metadata: Metadata = {
  title: "Privacy Policy | Spinora",
  description: "How Spinora collects, uses, and protects your information.",
  alternates: { canonical: "/privacy" },
};

const SECTIONS = [
  {
    heading: "Information we collect",
    body: "We collect account information (email, phone, name), transaction records, support messages, and usage data needed to operate the platform and prevent fraud.",
  },
  {
    heading: "How we use information",
    body: "We use your data to provide the service, process deposits and game loads, send account notifications, improve the platform, and comply with legal obligations.",
  },
  {
    heading: "Sharing",
    body: "We do not sell personal information. We share data with service providers (hosting, email, payment verification) under contract and when required by law.",
  },
  {
    heading: "Security",
    body: "We use industry-standard measures to protect accounts and financial records. No method of transmission over the internet is 100% secure.",
  },
  {
    heading: "Your choices",
    body: "You may update profile details from your dashboard and request account deletion by contacting support@spinoracasinos.com.",
  },
  {
    heading: "Contact",
    body: "Privacy questions: support@spinoracasinos.com.",
  },
];

export default function PrivacyPage() {
  return (
    <VipPageLayout>
      <main className="pb-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Privacy Policy" }]} />
          <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
          <div className="space-y-8">
            {SECTIONS.map((s) => (
              <section key={s.heading}>
                <h2 className="text-xl font-semibold mb-3">{s.heading}</h2>
                <p className="text-muted-foreground leading-relaxed">{s.body}</p>
              </section>
            ))}
          </div>
          <p className="mt-12 text-sm text-muted-foreground">
            See also our <Link href="/terms" className="text-orange-400 hover:underline">Terms of Service</Link>.
          </p>
        </div>
      </main>
    </VipPageLayout>
  );
}
