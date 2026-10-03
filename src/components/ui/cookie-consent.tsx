"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const SHOW_DELAY_MS = 8000;

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("spinora-cookies")) return;

    function show() {
      if (!localStorage.getItem("spinora-cookies")) setVisible(true);
    }

    // Delay so cookie bar is not the LCP element on mobile.
    const timer = window.setTimeout(show, SHOW_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  function accept() {
    localStorage.setItem("spinora-cookies", "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[60] p-3 sm:p-4 pointer-events-none">
      <div className="mx-auto max-w-4xl rounded-xl border border-purple-500/30 bg-[#1a1a1a]/95 backdrop-blur-sm p-3 sm:px-4 sm:py-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xl pointer-events-auto">
        <p className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left leading-snug">
          We use cookies. See{" "}
          <Link href="/about" className="text-primary hover:underline">
            Terms
          </Link>{" "}
          &{" "}
          <Link href="/about" className="text-primary hover:underline">
            Privacy
          </Link>
          .
        </p>
        <button
          type="button"
          onClick={accept}
          className="px-5 py-1.5 rounded-lg gradient-bg text-white text-sm font-semibold whitespace-nowrap hover:opacity-90 transition-opacity"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
