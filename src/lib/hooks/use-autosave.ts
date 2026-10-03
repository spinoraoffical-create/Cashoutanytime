"use client";

import { useEffect, useRef, useState } from "react";

export type AutosaveStatus = "idle" | "pending" | "saving" | "saved" | "error" | "offline";

/** Debounced autosave with status states for a UI indicator. No deps beyond React. */
export function useAutosave<T>(value: T, save: (value: T) => Promise<void>, delayMs = 1500) {
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useRef(value);
  const saveRef = useRef(save);
  const isFirstRun = useRef(true);
  latest.current = value;
  saveRef.current = save;

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setStatus("offline");
      return;
    }
    setStatus("pending");
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setStatus("saving");
      try {
        await saveRef.current(latest.current);
        setStatus("saved");
      } catch {
        setStatus("error");
      }
    }, delayMs);
    return () => clearTimeout(timer.current);
  }, [value, delayMs]);

  useEffect(() => {
    const onOffline = () => setStatus("offline");
    const onOnline = () => setStatus("idle");
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  return status;
}
