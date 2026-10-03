import { VipPageLayout } from "@/components/layout/vip-page-layout";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supportMetadata } from "@/lib/seo/metadata";
import { getPublishedFaqs } from "@/lib/data/faqs-public";
import Link from "next/link";
import { MessageCircle, Mail, HelpCircle, Clock } from "lucide-react";

export const metadata = supportMetadata;

const FALLBACK_FAQS = [
  { q: "How do I request a game account?", a: "Create a free account, navigate to your dashboard, and submit a game request. Our team will process it within 24 hours." },
  { q: "How does the VIP program work?", a: "Earn VIP points through game requests and referrals. Points unlock Bronze, Silver, Gold, and Platinum tiers with increasing benefits." },
  { q: "Is live chat available 24/7?", a: "Yes! Use the floating chat widget on any page or visit your dashboard messages for real-time support." },
  { q: "How do referrals work?", a: "Share your unique referral code. When friends sign up, you earn VIP points per referral." },
];

export default async function SupportPage() {
  const dbFaqs = await getPublishedFaqs();
  const faqs = dbFaqs.length
    ? dbFaqs.map((f) => ({ q: f.question, a: f.answer, category: f.category }))
    : FALLBACK_FAQS.map((f) => ({ ...f, category: "general" }));

  const grouped = faqs.reduce<Record<string, typeof faqs>>((acc, faq) => {
    const key = faq.category || "general";
    acc[key] = acc[key] ?? [];
    acc[key].push(faq);
    return acc;
  }, {});

  return (
    <VipPageLayout>
      <main className="pb-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Support" }]} />

          <div className="mb-12">
            <h1 className="text-4xl font-bold mb-4">
              Support & <span className="gradient-text">Help Center</span>
            </h1>
            <p className="text-muted-foreground max-w-2xl text-lg">
              Get help with game accounts, VIP questions, and technical issues. Our team is here 24/7.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-6 mb-16">
            {[
              { icon: MessageCircle, title: "Live Chat", desc: "Chat with our support team in real-time", action: "Open Chat", href: "/login" },
              { icon: Mail, title: "Email Support", desc: "support@spinoracasinos.com", action: "Send Email", href: "mailto:support@spinoracasinos.com" },
              { icon: Clock, title: "Response Time", desc: "Average response under 5 minutes", action: "Learn More", href: "/about" },
            ].map(({ icon: Icon, title, desc, action, href }) => (
              <Card key={title} className="hover:glow-purple transition-all">
                <CardHeader>
                  <div className="w-12 h-12 rounded-xl gradient-bg flex items-center justify-center mb-2">
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-lg">{title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">{desc}</p>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={href}>{action}</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mb-8 flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-orange-400" />
            <h2 className="text-2xl font-bold">Frequently Asked Questions</h2>
          </div>

          <div className="space-y-8">
            {Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                  {category.replace(/_/g, " ")}
                </h3>
                <div className="grid gap-4">
                  {items.map((faq) => (
                    <Card key={faq.q}>
                      <CardHeader>
                        <CardTitle className="text-base">{faq.q}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground whitespace-pre-line">{faq.a}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </VipPageLayout>
  );
}
