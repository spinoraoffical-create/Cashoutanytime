"use client";

import Link from "next/link";
import { Crown, Lock } from "lucide-react";

export function PremiumGate() {
  return (
    <section className="py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl glass border border-purple-500/30 p-8 sm:p-12 text-center">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-600/10 via-transparent to-blue-600/10" />
          <div className="relative">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/20 mb-6">
              <Lock className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">Unlock Premium Access</h2>
            <p className="text-muted-foreground max-w-lg mx-auto mb-8">
              Experience VIP perks, priority support, game account requests, and exclusive member-only features.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-xl gradient-bg text-white font-semibold hover:opacity-90 transition-opacity"
              >
                <Crown className="h-5 w-5" /> Login & Access All
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-xl border border-primary/40 text-primary font-semibold hover:bg-primary/10 transition-colors"
              >
                New Here? Claim Your Free Account
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
