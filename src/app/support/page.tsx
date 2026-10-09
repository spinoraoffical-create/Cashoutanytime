import { VipPageLayout } from "@/components/layout/vip-page-layout";
import { supportMetadata } from "@/lib/seo/metadata";
import { getPublishedFaqs } from "@/lib/data/faqs-public";
import { getAuthUser } from "@/lib/supabase/session";
import Link from "next/link";
import {
  ChevronRight,
  CircleHelp,
  Gamepad2,
  MessageCircle,
  Search,
  ShieldCheck,
  Wallet,
  ArrowDownToLine,
} from "lucide-react";

export const metadata = supportMetadata;

const TOPICS = [
  { id: "adding-money", title: "Adding money", hint: "Payment methods, pending deposits, and confirmations", icon: Wallet },
  { id: "cash-outs", title: "Cash outs", hint: "Eligibility, payout status, and returned funds", icon: ArrowDownToLine },
  { id: "games", title: "Games and balances", hint: "Launching games, in-game funds, and game cash outs", icon: Gamepad2 },
  { id: "account", title: "Account and safety", hint: "Sign-in, verification, privacy, and account protection", icon: ShieldCheck },
  { id: "rules", title: "Rules and responsible play", hint: "Program rules, limits, and play controls", icon: CircleHelp },
];

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const [{ q }, user, dbFaqs] = await Promise.all([
    searchParams,
    getAuthUser(),
    getPublishedFaqs(),
  ]);
  const chatHref = user ? "/support/chat" : "/login?redirect=/support/chat";
  const query = (q ?? "").trim().toLowerCase();
  const topics = TOPICS.filter(
    (topic) =>
      !query ||
      topic.title.toLowerCase().includes(query) ||
      topic.hint.toLowerCase().includes(query)
  );
  const faqs = dbFaqs
    .map((faq) => ({ q: faq.question, a: faq.answer }))
    .filter((faq) => !query || faq.q.toLowerCase().includes(query) || faq.a.toLowerCase().includes(query));

  return (
    <VipPageLayout>
      <main className="mx-auto w-full max-w-lg px-1 pb-16 text-[#fcf9fb]">
        <section className="space-y-3">
          <h1 className="text-3xl font-black">Contact us</h1>
          <p className="text-sm leading-6 text-[#b9b3c6]">
            An automated assistant answers first and identifies itself. You can request a person at any time.
          </p>
          <Link
            href={chatHref}
            className="flex h-14 items-center justify-between rounded-2xl bg-white px-4 text-base font-black text-[#14101c]"
          >
            <span className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" /> Start private chat
            </span>
            <ChevronRight className="h-5 w-5" />
          </Link>
        </section>

        <form action="/support" className="mt-6">
          <p className="mb-2 font-bold">Search support topics</p>
          <label className="flex items-center gap-2 rounded-2xl bg-white/8 px-4 py-3">
            <Search className="h-4 w-4 text-[#b9b3c6]" />
            <input
              name="q"
              defaultValue={q ?? ""}
              placeholder="Search support"
              className="w-full bg-transparent text-sm outline-none placeholder:text-[#b9b3c6]"
            />
          </label>
        </form>

        <section className="mt-6">
          <h2 className="text-2xl font-black">Browse topics</h2>
          <div className="mt-2 divide-y divide-white/10">
            {topics.map((topic) => {
              const Icon = topic.icon;
              return (
                <a key={topic.id} href={`#${topic.id}`} className="flex items-center gap-3 py-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/8">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{topic.title}</span>
                    <span className="mt-0.5 block text-sm text-[#b9b3c6]">{topic.hint}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-[#b9b3c6]" />
                </a>
              );
            })}
          </div>
        </section>

        <Link href="/help" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[#ff6b89]">
          <CircleHelp className="h-4 w-4" /> Read frequently asked questions
        </Link>

        {faqs.length > 0 && (
          <section className="mt-8 space-y-4">
            {TOPICS.map((topic) => (
              <div key={topic.id} id={topic.id} />
            ))}
            <h2 className="text-lg font-bold">Answers</h2>
            {faqs.map((faq) => (
              <article key={faq.q} className="rounded-2xl border border-white/10 p-4">
                <h3 className="font-semibold">{faq.q}</h3>
                <p className="mt-2 whitespace-pre-line text-sm text-[#b9b3c6]">{faq.a}</p>
              </article>
            ))}
          </section>
        )}
      </main>
    </VipPageLayout>
  );
}
