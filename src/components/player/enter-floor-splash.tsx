"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { SITE_NAME } from "@/lib/constants";

const KEY = "hub-entered-floor";

export function EnterFloorSplash() {
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (reduced) return;
    try {
      if (sessionStorage.getItem(KEY)) return;
      sessionStorage.setItem(KEY, "1");
      setVisible(true);
      const t = setTimeout(() => setVisible(false), 1400);
      return () => clearTimeout(t);
    } catch {
      /* ignore */
    }
  }, [reduced]);

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-[#07060c]"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          aria-hidden
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-lg font-black text-white shadow-[0_0_32px_rgba(255,45,85,0.55)]">
            SH
          </span>
          <p className="mt-4 text-lg font-extrabold tracking-tight">{SITE_NAME}</p>
          <p className="mt-1 text-sm text-zinc-400">Loading…</p>
          <motion.div
            className="mt-8 h-px w-40 bg-gradient-to-r from-transparent via-[#ffd666] to-transparent"
            initial={{ scaleX: 0, opacity: 0.4 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
          />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
