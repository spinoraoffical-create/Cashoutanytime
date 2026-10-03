"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/shared/glass-card";
import { UserPlus, Wallet, Gamepad2, Sparkles, CheckCircle2, ArrowRight } from "lucide-react";

export function HowItWorksGuide() {
  return (
    <GlassCard className="p-6 md:p-8 my-8 border-amber-500/30 bg-gradient-to-b from-amber-500/5 to-transparent">
      <div className="text-center max-w-2xl mx-auto mb-8">
        <span className="text-xs font-extrabold uppercase tracking-widest text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
          ⚡ Quick Start Guide
        </span>
        <h2 className="text-2xl md:text-3xl font-black text-foreground mt-3">
          How Spinora Royale VIP Works in 3 Easy Steps
        </h2>
        <p className="text-sm text-muted-foreground mt-2">
          Get your game account credentials and start playing Juwa, Game Vault, and Fire Kirin in under 2 minutes.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3 relative">
        {/* Step 1 */}
        <div className="rounded-2xl border border-border/60 bg-background/80 p-5 relative group hover:border-amber-500/50 transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 font-black text-lg">
              01
            </div>
            <UserPlus className="h-6 w-6 text-amber-400" />
          </div>
          <h3 className="text-base font-bold text-foreground">Create Free Account</h3>
          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
            Sign up on Spinora in 30 seconds with your email and phone number. Claim your $100 Sign-Up Bonus Match.
          </p>
        </div>

        {/* Step 2 */}
        <div className="rounded-2xl border border-border/60 bg-background/80 p-5 relative group hover:border-emerald-500/50 transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 font-black text-lg">
              02
            </div>
            <Wallet className="h-6 w-6 text-emerald-400" />
          </div>
          <h3 className="text-base font-bold text-foreground">Request Deposit & Game Load</h3>
          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
            Choose Cash App, USDT, PayPal, or Zelle. Send $10+ and enter your payment tag on your dashboard.
          </p>
        </div>

        {/* Step 3 */}
        <div className="rounded-2xl border border-border/60 bg-background/80 p-5 relative group hover:border-sky-500/50 transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400 font-black text-lg">
              03
            </div>
            <Gamepad2 className="h-6 w-6 text-sky-400" />
          </div>
          <h3 className="text-base font-bold text-foreground">Get App Credentials & Play</h3>
          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
            Our 24/7 automated bots generate your game username & password instantly. Log in and win big!
          </p>
        </div>
      </div>

      <div className="mt-8 text-center">
        <Link href="/register">
          <Button className="bg-amber-500 text-black hover:bg-amber-400 font-bold px-8 py-6 rounded-xl text-sm gap-2">
            <Sparkles className="h-4 w-4" /> Start Playing Now <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </GlassCard>
  );
}
