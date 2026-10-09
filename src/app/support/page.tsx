import { VipPageLayout } from "@/components/layout/vip-page-layout";
import { supportMetadata } from "@/lib/seo/metadata";
import { getPublishedFaqs } from "@/lib/data/faqs-public";
import { getAuthUser } from "@/lib/supabase/session";
import Link from "next/link";
import { MessageCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = supportMetadata;

const TOPICS = [
  { id: "adding-money", title: "Adding money", hint: "Payment methods, pending deposits, and confirmations" },
  { id: "cash-outs", title: "Cash outs", hint: "Eligibility, payout status, and returned funds" },
  { id: "games", title: "Games and balances", hint: "Launching games, in-game funds, and game cash outs" },
  { id: "account", title: "Account and safety", hint: "Sign-in, verification, privacy, and account protection" },
  { id: "rules", title: "Rules and responsible play", hint: "Program rules, limits, and play controls" },
];

export default async function SupportPage() {
  const [user, dbFaqs] = await Promise.all([getAuthUser(), getPublishedFaqs()]);
  const chatHref = user ? "/support/chat" : "/login?redirect=/support/chat";

  const faqs = dbFaqs.map((f) => ({ q: f.question, a: f.answer, category: f.category || "general" }));

  return (
    <VipPageLayout>
      <main className="mx-auto max-w-lg space-y-8 px-4 pb-24 pt-6 lg:max-w-3xl">
        <div>
          <h1 className="text-3xl font-extrabold">How can we help?</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Open a private, account-aware conversation or browse a topic first.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild className="flex-1 rounded-full">
            <Link href={chatHref}>
              <MessageCircle className="h-4 w-4" /> Start private chat
            </Link>
          </Button>
          <Button asChild variant="outline" className="flex-1 rounded-full">
            <Link href="/help">Frequently asked questions</Link>
          </Button>
        </div>

        <form action="/support" className="hub-card flex items-center gap-2 rounded-2xl px-3 py-2.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            name="q"
            placeholder="Search support topics"
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

        <section className="space-y-2">
          <h2 className="text-lg font-bold">Contact us</h2>
          <p className="text-sm text-muted-foreground">
            An automated assistant answers first and identifies itself. You can request a person at any time.
          </p>
          <Link href={chatHref} className="inline-flex text-sm font-bold text-[#ff6b89]">
            Start private chat
          </Link>
          <Link href="/help" className="block text-sm font-bold text-[#ff6b89]">
            Read frequently asked questions
          </Link>
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
