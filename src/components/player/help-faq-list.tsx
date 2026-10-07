"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { PLAYER_VIDEO_GUIDES } from "@/lib/player-video-guides";

const CHIPS = ["all", "general", "account", "rewards", "wallet", "redeem", "support"] as const;

const QUICK = ["move", "cashout-min", "still-in-game", "fees"];

function bucket(category: string) {
  const c = category.toLowerCase();
  if ((CHIPS as readonly string[]).includes(c)) return c;
  if (c.includes("wallet") || c.includes("deposit") || c.includes("pay")) return "wallet";
  if (c.includes("redeem") || c.includes("cash") || c.includes("payout")) return "redeem";
  if (c.includes("reward") || c.includes("bonus") || c.includes("vip")) return "rewards";
  if (c.includes("account") || c.includes("kyc") || c.includes("verif")) return "account";
  if (c.includes("support") || c.includes("help")) return "support";
  return "general";
}

export function HelpFaqList({
  faqs,
}: {
  faqs: { id: string; question: string; answer: string; category: string }[];
}) {
  const [chip, setChip] = useState<(typeof CHIPS)[number]>("all");
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return faqs.filter((faq) => {
      const inChip = chip === "all" || bucket(faq.category || "general") === chip;
      const inQuery = !q || `${faq.question} ${faq.answer}`.toLowerCase().includes(q);
      return inChip && inQuery;
    });
  }, [chip, faqs, query]);
  const quick = faqs.filter((faq) => QUICK.includes(faq.id));

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#1a1024] px-3 py-3">
        <Search className="h-4 w-4 text-[#b9b3c6]" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search FAQs"
          className="w-full bg-transparent text-sm outline-none"
        />
      </label>
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {CHIPS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setChip(item)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-wide ${
              chip === item ? "bg-[#ff6b89] text-[#3a1020]" : "bg-[#2e1f38] text-[#a3b0c2]"
            }`}
          >
            {item}
          </button>
        ))}
      </div>
      <Link href="/support" className="flex items-center justify-between rounded-2xl border border-white/10 px-4 py-3 text-sm font-bold">
        Still stuck? Contact support
        <ChevronRight className="h-4 w-4" />
      </Link>
      <div id="video-help" className="rounded-2xl border border-white/10 px-4 py-3">
        <p className="font-bold">Video help</p>
        <p className="text-sm text-[#b9b3c6]">Wallet, Freeplay, game-load, and cash-out guides.</p>
        <p className="mt-1 text-sm font-bold text-[#ff6b89]">Choose a guide · {PLAYER_VIDEO_GUIDES.length} videos</p>
        <ul className="mt-2 space-y-1 text-sm text-[#b9b3c6]">
          {PLAYER_VIDEO_GUIDES.map((guide) => (
            <li key={guide.id}>{guide.title}</li>
          ))}
        </ul>
      </div>
      <div className="overflow-hidden rounded-2xl border border-white/10">
        {visible.length === 0 ? (
          <p className="px-4 py-6 text-sm text-[#b9b3c6]">No answers match that search.</p>
        ) : (
          visible.map((faq) => (
            <details key={faq.id} className="border-b border-white/10 px-4 last:border-b-0">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold [&::-webkit-details-marker]:hidden">
                {faq.question}
                <ChevronRight className="h-4 w-4 shrink-0 text-[#b9b3c6]" />
              </summary>
              <p className="pb-3 text-sm leading-relaxed text-[#b9b3c6]">{faq.answer}</p>
            </details>
          ))
        )}
      </div>
      {quick.length ? (
        <div>
          <p className="mb-2 text-sm font-bold">Money & cashout — quick answers</p>
          <div className="overflow-hidden rounded-2xl border border-white/10">
            {quick.map((faq) => (
              <details key={faq.id} className="border-b border-white/10 px-4 last:border-b-0">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between text-sm font-bold [&::-webkit-details-marker]:hidden">
                  {faq.question}
                  <ChevronRight className="h-4 w-4 text-[#b9b3c6]" />
                </summary>
                <p className="pb-3 text-sm text-[#b9b3c6]">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      ) : null}
      <p className="text-sm font-bold">Jump to</p>
      <div className="grid grid-cols-2 gap-2">
        <Link href="#video-help" className="rounded-2xl border border-white/10 px-3 py-3 text-sm font-bold">Video tutorials</Link>
        <Link href="/dashboard/wallet" className="rounded-2xl border border-white/10 px-3 py-3 text-sm font-bold">Add funds</Link>
        <Link href="/dashboard/withdraw" className="rounded-2xl border border-white/10 px-3 py-3 text-sm font-bold">Cash out</Link>
        <Link href="/dashboard/verification" className="rounded-2xl border border-white/10 px-3 py-3 text-sm font-bold">Verify account</Link>
        <Link href="/support" className="rounded-2xl border border-white/10 px-3 py-3 text-sm font-bold">Contact support</Link>
        <Link href="/dashboard/welcome" className="rounded-2xl border border-white/10 px-3 py-3 text-sm font-bold">Show getting started</Link>
        <Link href="/support" className="col-span-2 rounded-2xl border border-white/10 px-3 py-3 text-sm font-bold">Send feedback</Link>
      </div>
    </div>
  );
}
