"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { HOME_FAQS } from "@/lib/seo/faq-data";
import { HomeSection } from "@/components/home/home-section";
import { cn } from "@/lib/utils";

const FAQS = HOME_FAQS;

export function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <HomeSection tinted>
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">
            Frequently Asked <span className="gradient-text">Questions</span>
          </h2>
          <p className="text-muted-foreground text-sm">Have any questions? We&apos;ve got answers.</p>
        </div>

        <div className="space-y-3">
          {FAQS.map((faq, i) => (
            <div key={i} className="rounded-xl overflow-hidden bg-[#1e1e1e] border border-white/5">
              <button
                type="button"
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between p-4 sm:p-5 text-left hover:bg-white/5 transition-colors"
              >
                <span className="font-semibold text-sm pr-4">{faq.q}</span>
                <ChevronDown
                  className={cn(
                    "h-5 w-5 text-orange-400 flex-shrink-0 transition-transform",
                    open === i && "rotate-180"
                  )}
                />
              </button>
              <AnimatePresence>
                {open === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <p className="px-4 sm:px-5 pb-4 text-sm text-muted-foreground leading-relaxed">
                      {faq.a}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </HomeSection>
  );
}
