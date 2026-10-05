"use client";

import { motion } from "framer-motion";
import { usePlayerMotion } from "@/lib/player-motion";
import { cn } from "@/lib/utils";

export function MotionPage({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const motionPrefs = usePlayerMotion();
  return (
    <motion.div
      className={cn(className)}
      initial={motionPrefs.page.initial || undefined}
      animate={motionPrefs.page.animate}
      transition={motionPrefs.page.transition}
    >
      {children}
    </motion.div>
  );
}
