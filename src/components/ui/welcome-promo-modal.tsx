"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, Sparkles, Trophy, Gift, ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function WelcomePromoModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Check if user dismissed the welcome modal today
    const dismissedAt = localStorage.getItem("spinora_welcome_modal_dismissed");
    if (dismissedAt) {
      const hours = (Date.now() - Number(dismissedAt)) / (1000 * 60 * 60);
      if (hours < 24) return;
    }

    // Trigger popup after 2 seconds
    const timer = setTimeout(() => {
      setOpen(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  function handleDismiss() {
    setOpen(false);
    localStorage.setItem("spinora_welcome_modal_dismissed", Date.now().toString());
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-amber-500/40 bg-[#161618] p-6 text-center shadow-2xl shadow-amber-500/10">
        {/* Top Glow Accent */}
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 h-32 w-32 rounded-full bg-amber-500/20 blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={handleDismiss}
          className="absolute right-3 top-3 rounded-full p-1.5 text-muted-foreground hover:bg-white/10 hover:text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Emblem Badge */}
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
          <Trophy className="h-8 w-8 animate-pulse" />
        </div>

        {/* Modal Text */}
        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
          👑 EXCLUSIVE WELCOME OFFER
        </span>

        <h2 className="text-2xl font-extrabold text-foreground mt-3 tracking-tight">
          Claim Your $100 Sign-Up Bonus Match!
        </h2>

        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
          Sign up today on Spinora Royale VIP to unlock your 100% deposit match + daily Wheel of Fortune free spin rewards!
        </p>

        {/* Promo Code Highlight */}
        <div className="my-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 flex items-center justify-between">
          <div className="text-left">
            <span className="text-[10px] uppercase font-bold text-amber-400 block">Promo Code</span>
            <span className="font-mono text-base font-black text-amber-300">ROYALE100</span>
          </div>
          <Badge className="bg-amber-500 text-black font-bold text-xs">100% MATCH</Badge>
        </div>

        {/* Buttons */}
        <div className="space-y-2">
          <Link href="/register" onClick={handleDismiss} className="block">
            <Button className="w-full bg-amber-500 text-black hover:bg-amber-400 font-bold py-6 rounded-xl text-sm gap-2">
              <Sparkles className="h-4 w-4" /> Claim $100 Bonus & Play Now <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>

          <button
            onClick={handleDismiss}
            className="text-xs text-muted-foreground hover:text-white transition-colors py-1 block w-full"
          >
            Continue to website
          </button>
        </div>

        {/* Security Badge */}
        <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground border-t border-border/40 pt-3">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
          <span>24/7 Verified Instant Bot Account Provisioning</span>
        </div>
      </div>
    </div>
  );
}
