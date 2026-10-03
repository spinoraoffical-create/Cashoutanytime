import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert, MapPin, Headphones } from "lucide-react";
import { GlassCard } from "@/components/shared/glass-card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Access Restricted | Spinora",
  description: "Spinora sweepstakes games are not available in your state due to local regulations.",
};

export default function RestrictedPage() {
  return (
    <div className="lobby-cosmic min-h-screen flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.12)_0%,transparent_60%)] pointer-events-none" />
      
      <GlassCard className="max-w-md w-full p-8 border-red-500/25 bg-[#090909]/90 text-center relative overflow-hidden">
        {/* Glowing red accent */}
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-40 h-40 bg-red-600/10 blur-3xl rounded-full" />

        <div className="mx-auto w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(239,68,68,0.15)] animate-pulse">
          <ShieldAlert className="h-8 w-8 text-red-500" />
        </div>

        <h1 className="text-2xl font-black text-white tracking-tight uppercase">
          Access <span className="text-red-500">Restricted</span>
        </h1>
        
        <p className="text-sm text-purple-200/60 mt-2 flex items-center justify-center gap-1.5 font-semibold">
          <MapPin className="h-4 w-4 text-red-500/80" /> Regional Compliance Guard
        </p>

        <div className="my-6 border-y border-purple-500/15 py-4 text-sm text-muted-foreground leading-relaxed text-left space-y-3">
          <p>
            Spinora enforces strict geographic boundaries to comply with state-level sweepstakes regulations. 
            Our platform does not offer online slot play, fish shooter accounts, or wallet loading services in your state.
          </p>
          <p className="text-xs bg-white/5 border border-white/5 rounded-lg p-2.5 font-mono text-purple-200/50">
            Commonly restricted states: Washington (WA), Idaho (ID), Nevada (NV), and Michigan (MI).
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Button asChild className="bg-red-500 text-black hover:bg-red-400 font-bold py-5 rounded-xl shadow-[0_0_15px_rgba(239,68,68,0.2)] transition-all">
            <a href="https://t.me/+Y80HSM0UiZw5ODdh" target="_blank" rel="noopener noreferrer">
              <Headphones className="mr-2 h-4 w-4" /> Message Support on Telegram
            </a>
          </Button>

          <Button asChild variant="ghost" className="text-purple-200/70 hover:text-white hover:bg-purple-950/40 py-5 rounded-xl">
            <Link href="/">Back to Homepage</Link>
          </Button>
        </div>
      </GlassCard>
    </div>
  );
}
