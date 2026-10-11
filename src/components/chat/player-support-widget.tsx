"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageCircle, X } from "lucide-react";

import { AgentThread } from "@/components/agents/agent-thread";
import { loadMyParentAgent } from "@/lib/actions/player-tickets";
import { SUPPORT_TOPIC_PROMPTS, supportTopicReply } from "@/lib/ai/escalate";
import { createClient } from "@/lib/supabase/client";

const TOPIC_LABELS: Record<string, string> = {
  "adding-money": "Adding money",
  "cash-outs": "Cash outs",
  games: "Games",
  account: "Account",
  rules: "Rules",
};

const TABS = ["Home", "Live Chat", "FAQs"] as const;
const FAQS = [
  { q: "How do I add money?", a: "Open Wallet, choose an amount, and pay with Paydora." },
  { q: "How do cash outs work?", a: "Cash out uses the Cash out ready balance after your ID is verified." },
  { q: "Who gets Live Chat?", a: "Live Chat goes to the store or sub-creator on your account." },
];

export function PlayerSupportWidget() {
  const pathname = usePathname();
  const [signedIn, setSignedIn] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Home");
  const [topicNote, setTopicNote] = useState<string | null>(null);
  const [agentId, setAgentId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    void supabase.auth.getUser().then(({ data }) => {
      setSignedIn(Boolean(data.user));
      setUserId(data.user?.id ?? null);
    });
  }, []);

  useEffect(() => {
    if (!open || tab !== "Live Chat" || !signedIn) return;
    let cancelled = false;
    void loadMyParentAgent().then((result) => {
      if (!cancelled) setAgentId(result.agentId);
    });
    return () => {
      cancelled = true;
    };
  }, [open, signedIn, tab]);

  if (!signedIn || !userId || pathname?.startsWith("/admin")) return null;

  return (
    <div className="fixed bottom-24 right-4 z-40 flex flex-col items-end gap-2">
      {open ? (
        <section className="flex h-[28rem] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#14101c] text-[#fcf9fb] shadow-xl">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
            <p className="text-sm font-black">Help</p>
            <button type="button" aria-label="Close help" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex gap-1 border-b border-white/10 p-2">
            {TABS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setTab(item)}
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  tab === item ? "bg-white text-[#14101c]" : "bg-white/10"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            {tab === "Home" ? (
              <div className="h-full space-y-2 overflow-y-auto p-3">
                <p className="text-sm text-[#b9b3c6]">Pick a topic.</p>
                {Object.entries(SUPPORT_TOPIC_PROMPTS).map(([id, prompt]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTopicNote(supportTopicReply(prompt) ?? "This stays on this screen.")}
                    className="block w-full rounded-2xl border border-white/10 px-3 py-2 text-left text-sm font-bold"
                  >
                    {TOPIC_LABELS[id] ?? prompt}
                  </button>
                ))}
                {topicNote ? <p className="text-sm text-[#b9b3c6]">{topicNote}</p> : null}
              </div>
            ) : null}
            {tab === "Live Chat" ? (
              <div className="h-full p-3">
                {agentId === undefined ? (
                  <p className="text-sm text-[#b9b3c6]">Loading…</p>
                ) : agentId ? (
                  <AgentThread playerId={userId} agentId={agentId} selfId={userId} compact />
                ) : (
                  <p className="text-sm text-[#b9b3c6]">You are not assigned.</p>
                )}
              </div>
            ) : null}
            {tab === "FAQs" ? (
              <ul className="h-full space-y-3 overflow-y-auto p-3">
                {FAQS.map((faq) => (
                  <li key={faq.q}>
                    <p className="text-sm font-bold">{faq.q}</p>
                    <p className="text-sm text-[#b9b3c6]">{faq.a}</p>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </section>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="grid h-14 w-14 place-items-center rounded-full bg-white text-[#14101c]"
        aria-label="Open help"
      >
        <MessageCircle className="h-6 w-6" />
      </button>
    </div>
  );
}
