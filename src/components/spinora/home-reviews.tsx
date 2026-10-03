import Link from "next/link";
import { Heart, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  formatReviewDisplayName,
  formatReviewVipTier,
} from "@/lib/reviews/display";
import type { ReviewWithAuthor } from "@/types/database";

export function HomeReviews({ reviews }: { reviews: ReviewWithAuthor[] }) {
  if (!reviews.length) return null;

  return (
    <section aria-labelledby="reviews-heading" className="mx-auto max-w-7xl scroll-mt-24 px-4 sm:px-6">
      <div className="mb-10">
        <p className="hud-label text-ws-gold-deep dark:text-ws-gold">Player reviews</p>
        <h2 id="reviews-heading" className="mt-1 text-3xl font-bold sm:text-4xl">
          Trusted by thousands of players
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
          Real feedback from Spinora members on instant accounts, fast cash-outs and our support.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {reviews.map((review) => (
          <figure key={review.id} className="glass ws-sheen flex h-full flex-col rounded-2xl p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex gap-0.5" aria-label={`${review.rating} out of 5 stars`}>
                {Array.from({ length: 5 }).map((_, s) => (
                  <Star
                    key={s}
                    className={
                      s < review.rating
                        ? "size-3.5 fill-ws-gold text-ws-gold"
                        : "size-3.5 text-foreground/15"
                    }
                    aria-hidden
                  />
                ))}
              </div>
              {review.admin_liked && (
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/10 px-2 py-0.5 text-[10px] font-medium text-orange-400">
                  <Heart className="size-3 fill-current" aria-hidden />
                  Team pick
                </span>
              )}
            </div>
            <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-foreground/90">
              &ldquo;{review.comment}&rdquo;
            </blockquote>
            {review.admin_comment && (
              <p className="mt-3 border-l-2 border-orange-500/40 pl-3 text-xs leading-relaxed text-orange-200/80">
                <span className="font-semibold text-orange-300">Spinora Team: </span>
                {review.admin_comment}
              </p>
            )}
            <figcaption className="mt-4 flex items-center gap-3">
              <span className="aurum-gradient-bg flex size-9 items-center justify-center rounded-full text-sm font-bold text-white">
                {formatReviewDisplayName(review).charAt(0)}
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">{formatReviewDisplayName(review)}</p>
                <p className="text-xs text-muted-foreground">{formatReviewVipTier(review)}</p>
              </div>
            </figcaption>
          </figure>
        ))}
      </div>

      <div className="mt-8 text-center">
        <Button variant="outline" asChild>
          <Link href="/dashboard/reviews">See all reviews</Link>
        </Button>
      </div>
    </section>
  );
}
