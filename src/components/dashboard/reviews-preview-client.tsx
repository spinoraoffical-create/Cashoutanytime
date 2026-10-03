"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StarRating } from "@/components/reviews/star-rating";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardSession } from "@/lib/dashboard/use-dashboard-session";
import { Star, Heart } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import type { ReviewWithAuthor } from "@/types/database";

function previewName(fullName?: string | null, email?: string | null) {
  const name = fullName?.trim();
  if (name) return name;
  if (email && !email.endsWith("@phone.spinora.local")) return email.split("@")[0];
  return "Player";
}

export function ReviewsPreviewClient() {
  const { supabase, ready } = useDashboardSession();
  const [reviews, setReviews] = useState<ReviewWithAuthor[]>([]);
  const [stats, setStats] = useState({ count: 0, average: 0 });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!ready || !supabase) return;

    let cancelled = false;
    void Promise.all([
      supabase
        .from("reviews")
        .select(
          "*, author:profiles!reviews_user_id_fkey(full_name, email, avatar_url, vip_tier)"
        )
        .order("created_at", { ascending: false })
        .limit(5),
      supabase.from("reviews").select("rating"),
    ]).then(([reviewsRes, ratingsRes]) => {
      if (cancelled) return;
      const rows = ratingsRes.data ?? [];
      const sum = rows.reduce((acc, r) => acc + r.rating, 0);
      setReviews((reviewsRes.data ?? []) as ReviewWithAuthor[]);
      setStats({
        count: rows.length,
        average: rows.length ? Math.round((sum / rows.length) * 10) / 10 : 0,
      });
      setLoaded(true);
    });

    return () => {
      cancelled = true;
    };
  }, [ready, supabase]);

  if (!loaded) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-20 rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  const featured = [...reviews]
    .sort((a, b) => {
      if (a.admin_liked !== b.admin_liked) return a.admin_liked ? -1 : 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    })
    .slice(0, 3);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle className="flex items-center gap-2">
          <Star className="h-5 w-5 text-amber-400" />
          Community Reviews
        </CardTitle>
        {stats.count > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <StarRating value={Math.round(stats.average)} readonly size="sm" />
            <span>
              {stats.average} ({stats.count})
            </span>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {featured.length > 0 ? (
          <>
            <div className="space-y-3">
              {featured.map((review) => (
                <div
                  key={review.id}
                  className="p-3 rounded-lg bg-muted/50 border border-white/5"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {previewName(review.author?.full_name, review.author?.email)}
                      </p>
                      {review.admin_liked && (
                        <Heart className="h-3 w-3 text-orange-400 fill-orange-400 shrink-0" />
                      )}
                    </div>
                    <StarRating value={review.rating} readonly size="sm" />
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{review.comment}</p>
                  <p className="text-[10px] text-muted-foreground/70 mt-1">
                    {formatRelativeTime(review.created_at)}
                  </p>
                </div>
              ))}
            </div>
            <Button variant="outline" asChild className="w-full">
              <Link href="/dashboard/reviews" prefetch>
                View all reviews & write yours
              </Link>
            </Button>
          </>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-3">
              No reviews yet — be the first to share your experience!
            </p>
            <Button asChild>
              <Link href="/dashboard/reviews" prefetch>
                Write a review
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
