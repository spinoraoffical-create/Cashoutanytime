"use client";

import { useEffect, useRef, useState } from "react";

/** True once the element is near or inside the viewport. */
export function useInView(rootMargin = "200px", immediate = false) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(immediate);

  useEffect(() => {
    if (immediate || inView) return;
    const node = ref.current;
    if (!node) return;
    if (!("IntersectionObserver" in window)) {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [immediate, inView, rootMargin]);

  return { ref, inView };
}
