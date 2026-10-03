"use client";

import Link from "next/link";
import { REFERRAL_REWARD_POINTS } from "@/lib/constants";
import { motion } from "framer-motion";
import { Share2, Users, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HomeSection } from "@/components/home/home-section";

export function ReferralPreview() {
  return (
    <HomeSection tinted>
      <div className="rounded-2xl p-6 sm:p-8 grid lg:grid-cols-2 gap-8 items-center bg-[#1e1e1e] border border-white/5">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">
            Refer & <span className="gradient-text">Earn Rewards</span>
          </h2>
          <p className="text-muted-foreground mb-6 text-sm sm:text-base">
            Share your unique referral link and earn VIP points for every friend who joins Spinora.
          </p>
          <Button asChild>
            <Link href="/register">Start Referring</Link>
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="grid grid-cols-3 gap-3"
        >
          {[
            { icon: Share2, label: "Share Link", value: "1-Click" },
            { icon: Users, label: "Friends Join", value: `+${REFERRAL_REWARD_POINTS} pts` },
            { icon: Gift, label: "Earn Rewards", value: "Up to 25%" },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="text-center p-3 rounded-xl bg-[#161616] border border-white/5">
                <Icon className="h-5 w-5 text-orange-400 mx-auto mb-2" />
                <p className="text-base font-bold gradient-text">{item.value}</p>
                <p className="text-[10px] text-muted-foreground">{item.label}</p>
              </div>
            );
          })}
        </motion.div>
      </div>
    </HomeSection>
  );
}
