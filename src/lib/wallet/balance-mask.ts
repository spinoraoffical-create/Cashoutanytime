"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "hub-balances-hidden";
const EVENT = "hub-balances-hidden";

export function useBalanceMask() {
  const [masked, setMasked] = useState(false);

  useEffect(() => {
    setMasked(localStorage.getItem(KEY) === "1");
    function sync() {
      setMasked(localStorage.getItem(KEY) === "1");
    }
    window.addEventListener("storage", sync);
    window.addEventListener(EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(EVENT, sync);
    };
  }, []);

  const toggle = useCallback(() => {
    setMasked((prev) => {
      const next = !prev;
      localStorage.setItem(KEY, next ? "1" : "0");
      window.dispatchEvent(new Event(EVENT));
      return next;
    });
  }, []);

  return { masked, toggle };
}
