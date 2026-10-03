"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HomeSection } from "@/components/home/home-section";
import { VIP_TIERS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function VipPreview() {
  return (
    <HomeSection>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-10"
      >
        <h2 className="text-2xl sm:text-3xl font-bold mb-3">
          <Crown className="inline h-7 w-7 text-yellow-400 mr-2" />
          VIP <span className="gradient-text">Rewards</span>
        </h2>
        <p className="text-muted-foreground max-w-2xl mx-auto text-sm sm:text-base">
          Climb the ranks from Bronze to Platinum and unlock exclusive gaming benefits.
        </p>
      </motion.div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {VIP_TIERS.map((tier, i) => (
          <motion.div
            key={tier.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="rounded-xl p-5 bg-[#1e1e1e] border border-white/5 hover:border-orange-500/20 transition-colors"
          >
            <div className={cn("h-1 w-12 rounded-full bg-gradient-to-r mb-3", tier.color)} />
            <h3 className="text-base font-bold mb-1">{tier.name}</h3>
            <p className="text-xs text-muted-foreground mb-3">{tier.minPoints}+ points</p>
            <ul className="space-y-1.5">
              {tier.benefits.map((b) => (
                <li key={b} className="text-xs text-muted-foreground flex items-start gap-2">
                  <span className="text-orange-400 mt-0.5">&#10003;</span> {b}
                </li>
              ))}
            </ul>
          </motion.div>
        ))}
      </div>

      <div className="text-center mt-8">
        <Button asChild>
          <Link href="/vip">Explore VIP Program</Link>
        </Button>
      </div>
    </HomeSection>
  );
}
