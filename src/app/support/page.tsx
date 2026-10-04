import { VipPageLayout } from "@/components/layout/vip-page-layout";
import { supportMetadata } from "@/lib/seo/metadata";
import { getPublishedFaqs } from "@/lib/data/faqs-public";
import { getAuthUser } from "@/lib/supabase/session";
import Link from "next/link";
import { MessageCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = supportMetadata;

const TOPICS = [
  { id: "adding-money", title: "Adding money", hint: "Deposits to Main Wallet" },
  { id: "cash-outs", title: "Cash outs", hint: "Redeem, then withdraw" },
  { id: "games", title: "Games and balances", hint: "Load + redeem in Game Rooms" },
  { id: "account", title: "Account and safety", hint: "Login, KYC, devices" },
  { id: "rules", title: "Rules and responsible play", hint: "Terms, limits, 18+" },
];

export default async function SupportPage() {
  const [user, dbFaqs] = await Promise.all([getAuthUser(), getPublishedFaqs()]);
  const chatHref = user ? "/dashboard/messages" : "/login?redirect=/dashboard/messages";

  const faqs = dbFaqs.map((f) => ({ q: f.question, a: f.answer, category: f.category || "general" }));

  return (
    <VipPageLayout>
      <main className="mx-auto max-w-lg space-y-8 px-4 pb-24 pt-6 lg:max-w-3xl">
        <div>
          <h1 className="text-3xl font-extrabold">How can we help?</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Search topics or start a conversation. Guest chat can&apos;t see balances or payments — sign in for private support.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild className="flex-1 rounded-full">
            <Link href={chatHref}>
              <MessageCircle className="h-4 w-4" /> Start private chat
            </Link>
          </Button>
          <Button asChild variant="outline" className="flex-1 rounded-full">
            <a href="mailto:support@spinoracasinos.com">Contact support</a>
          </Button>
        </div>

        <form action="/support" className="hub-card flex items-center gap-2 rounded-2xl px-3 py-2.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            name="q"
            placeholder="Search support"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </form>

        <section>
          <h2 className="mb-3 text-lg font-bold">Browse topics</h2>
          <div className="grid gap-2">
            {TOPICS.map((t) => (
              <a key={t.id} href={`#${t.id}`} className="hub-card rounded-2xl p-4">
                <p className="font-semibold">{t.title}</p>
                <p className="text-sm text-muted-foreground">{t.hint}</p>
              </a>
            ))}
          </div>
        </section>

        {faqs.length > 0 && (
          <section className="space-y-4">
            <div id="adding-money" />
            <div id="cash-outs" />
            <div id="games" />
            <div id="account" />
            <div id="rules" />
            <h2 className="text-lg font-bold">Answers</h2>
            {faqs.map((faq) => (
              <article key={faq.q} className="hub-card rounded-2xl p-4">
                <h3 className="font-semibold">{faq.q}</h3>
                <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{faq.a}</p>
              </article>
            ))}
          </section>
        )}
      </main>
    </VipPageLayout>
  );
}
