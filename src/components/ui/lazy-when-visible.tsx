"use client";

import type { ReactNode } from "react";
import { useInView } from "@/lib/hooks/use-in-view";
import { cn } from "@/lib/utils";

interface LazyWhenVisibleProps {
  children: ReactNode;
  /** Shown until the section scrolls near the screen */
  placeholder?: ReactNode;
  className?: string;
  rootMargin?: string;
}

export function LazyWhenVisible({
  children,
  placeholder,
  className,
  rootMargin = "300px",
}: LazyWhenVisibleProps) {
  const { ref, inView } = useInView(rootMargin);

  return (
    <div ref={ref} className={cn(className)}>
      {inView
        ? children
        : placeholder ?? <div className="h-32 rounded-xl bg-white/[0.03] animate-pulse" aria-hidden />}
    </div>
  );
}
