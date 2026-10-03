"use client";

import { motion } from "framer-motion";
import { UserPlus, Gamepad2, Crown, Gift } from "lucide-react";
import { HomeSection } from "@/components/home/home-section";

const steps = [
  {
    icon: UserPlus,
    title: "Create Account",
    description: "Sign up for free and get your unique referral code instantly.",
  },
  {
    icon: Gamepad2,
    title: "Request Game Account",
    description: "Choose from 14+ popular gaming platforms and submit your request.",
  },
  {
    icon: Crown,
    title: "Earn VIP Rewards",
    description: "Accumulate points and unlock Bronze to Platinum VIP tiers.",
  },
  {
    icon: Gift,
    title: "Enjoy Benefits",
    description: "Get priority support, exclusive promotions, and referral bonuses.",
  },
];

export function HowItWorks() {
  return (
    <HomeSection tinted>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-10"
      >
        <h2 className="text-2xl sm:text-3xl font-bold mb-3">
          How <span className="gradient-text">Spinora</span> Works
        </h2>
        <p className="text-muted-foreground max-w-2xl mx-auto text-sm sm:text-base">
          Get started in minutes with our simple 4-step process.
        </p>
      </motion.div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="rounded-xl p-5 text-center bg-[#1e1e1e] border border-white/5 hover:border-orange-500/20 transition-colors"
            >
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl gradient-bg mb-3">
                <Icon className="h-6 w-6 text-white" />
              </div>
              <div className="text-xs text-orange-400 font-semibold mb-1.5">Step {i + 1}</div>
              <h3 className="font-semibold mb-1.5 text-sm">{step.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>
            </motion.div>
          );
        })}
      </div>
    </HomeSection>
  );
}
