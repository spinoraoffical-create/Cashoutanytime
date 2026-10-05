"use client";

import { useReducedMotion, type Transition } from "framer-motion";

export function usePlayerMotion() {
  const reduced = useReducedMotion();
  const ease: Transition["ease"] = "easeOut";

  return {
    reduced: Boolean(reduced),
    page: reduced
      ? { initial: false as const, animate: { opacity: 1, y: 0 }, transition: { duration: 0 } }
      : {
          initial: { opacity: 0, y: 12 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.3, ease },
        },
    stagger: reduced ? 0 : 0.05,
    tap: reduced ? undefined : { scale: 0.97 },
    hover: reduced ? undefined : { y: -2 },
  };
}
