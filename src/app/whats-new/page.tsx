"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { VipPageLayout } from "@/components/layout/vip-page-layout";

const NOTES = [
  "Game pages show your username and password after the account is created.",
  "Wallet uses the payment-method grid, and Security, Responsible Gaming, and Affiliate are in Account.",
  "Inbox, notification settings, and Help & FAQ follow the same account layout.",
];

export default function WhatsNewPage() {
  useEffect(() => {
    localStorage.setItem("hub-whats-new-seen", "1");
  }, []);

  return (
    <VipPageLayout>
    <div className="mx-auto w-full max-w-3xl space-y-4 px-1 pb-10">
      <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm font-semibold text-[#b9b3c6]">
        <ChevronLeft className="h-4 w-4" /> Back
      </Link>
      <h1 className="text-4xl font-black">What&apos;s new</h1>
      <ul className="space-y-3">
        {NOTES.map((note) => (
          <li key={note} className="rounded-2xl border border-white/10 bg-[#1a1024] px-4 py-3 text-sm">
            {note}
          </li>
        ))}
      </ul>
    </div>
    </VipPageLayout>
  );
}
