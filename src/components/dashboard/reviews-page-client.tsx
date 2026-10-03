"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReviewForm } from "@/components/reviews/review-form";
import { ReviewCard } from "@/components/reviews/review-card";
import { StarRating } from "@/components/reviews/star-rating";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { DashboardRouteLoading } from "@/components/dashboard/dashboard-route-loading";
import { useDashboardSession } from "@/lib/dashboard/use-dashboard-session";
import { Star } from "lucide-react";
import type { Review, ReviewWithAuthor } from "@/types/database";

const REVIEW_AUTHOR_SELECT =
  "*, author:profiles!reviews_user_id_fkey(full_name, email, avatar_url, vip_tier)";

export function ReviewsPageClient() {
  const { supabase, userId, ready } = useDashboardSession();
  const [reviews, setReviews] = useState<ReviewWithAuthor[]>([]);
  const [myReview, setMyReview] = useState<Review | null>(null);
  const [stats, setStats] = useState({ count: 0, average: 0 });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!ready || !supabase || !userId) return;

    let cancelled = false;
    void Promise.all([
      supabase
        .from("reviews")
        .select(REVIEW_AUTHOR_SELECT)
        .order("created_at", { ascending: false })
        .limit(40),
      supabase.from("reviews").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("reviews").select("rating"),
    ]).then(([reviewsRes, myRes, ratingsRes]) => {
      if (cancelled) return;
      const rows = ratingsRes.data ?? [];
      const sum = rows.reduce((acc, r) => acc + r.rating, 0);
      setReviews((reviewsRes.data ?? []) as ReviewWithAuthor[]);
      setMyReview(myRes.data);
      setStats({
        count: rows.length,
        average: rows.length ? Math.round((sum / rows.length) * 10) / 10 : 0,
      });
      setLoaded(true);
    });

    return () => {
      cancelled = true;
    };
  }, [ready, supabase, userId]);

  if (!loaded) {
    return <DashboardRouteLoading cards={3} />;
  }

  const likedFirst = [...reviews].sort((a, b) => {
    if (a.admin_liked !== b.admin_liked) return a.admin_liked ? -1 : 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div>
      <DashboardPageHeader
        title="Community Reviews"
        description="Share your experience and read what other players think about Spinora"
      />

      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-3xl font-bold gradient-text">{stats.average || "—"}</p>
            <p className="text-sm text-muted-foreground mb-2">Average rating</p>
            {stats.average > 0 && (
              <StarRating value={Math.round(stats.average)} readonly size="sm" className="justify-center" />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-3xl font-bold gradient-text">{stats.count}</p>
            <p className="text-sm text-muted-foreground">Total reviews</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-3xl font-bold gradient-text">
              {reviews.filter((r) => r.admin_liked).length}
            </p>
            <p className="text-sm text-muted-foreground">Team picks</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-2 h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-400" />
              {myReview ? "Your review" : "Write a review"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ReviewForm existingReview={myReview} />
          </CardContent>
        </Card>

        <div className="lg:col-span-3 space-y-4">
          <h2 className="text-lg font-semibold">All reviews</h2>
          {likedFirst.length > 0 ? (
            likedFirst.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                isOwn={review.user_id === userId}
              />
            ))
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No reviews yet. Be the first to share your experience!
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
