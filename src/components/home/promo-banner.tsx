"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

export function PromoBanner() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden bg-gradient-to-r from-purple-900/80 via-[#4c1d95] to-blue-900/80 border-b border-purple-500/30"
    >
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMtOS45NDEgMC0xOCA4LjA1OS0xOCAxOHM4LjA1OSAxOCAxOCAxOCAxOC04LjA1OSAxOC0xOC04LjA1OS0xOC0xOC0xOHoiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIvPjwvZz48L3N2Zz4=')] opacity-40" />
      <div className="relative mx-auto max-w-7xl px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-center sm:text-left">
          <Sparkles className="h-5 w-5 text-amber-400 flex-shrink-0" />
          <p className="text-sm sm:text-base font-medium text-white">
            Unlock Your Weekend Boost — <span className="text-amber-300 font-bold">Up to 50% Extra VIP Points</span>
          </p>
        </div>
        <Link
          href="/promotions"
          className="px-5 py-1.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-gray-900 text-sm font-bold hover:scale-105 transition-transform whitespace-nowrap"
        >
          Avail Now
        </Link>
      </div>
    </motion.div>
  );
}
