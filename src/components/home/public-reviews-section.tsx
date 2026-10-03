"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { getPublicReviews } from "@/lib/actions/reviews";
import type { ReviewWithAuthor } from "@/types/database";

const Testimonials = dynamic(
  () => import("@/components/home/testimonials").then((m) => m.Testimonials),
  { loading: () => <div className="h-32 rounded-xl bg-white/[0.03] animate-pulse" aria-hidden /> }
);

export function PublicReviewsSection() {
  const ref = useRef<HTMLDivElement>(null);
  const [reviews, setReviews] = useState<ReviewWithAuthor[] | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const load = () => {
      void getPublicReviews(6).then((data) => setReviews(data));
    };

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) {
            load();
            observer.disconnect();
          }
        },
        { rootMargin: "200px" }
      );
      observer.observe(node);
      return () => observer.disconnect();
    }

    const timer = setTimeout(load, 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div ref={ref}>
      <Testimonials reviews={reviews ?? []} />
    </div>
  );
}
