import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StarRating } from "@/components/reviews/star-rating";
import { getReviews, getReviewStats } from "@/lib/actions/reviews";
import { Star, Heart } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";

function previewName(fullName?: string | null, email?: string | null) {
  const name = fullName?.trim();
  if (name) return name;
  if (email && !email.endsWith("@phone.spinora.local")) return email.split("@")[0];
  return "Player";
}

export async function ReviewsPreview({
  reviewStats: statsProp,
}: {
  reviewStats?: { count: number; average: number };
}) {
  const [reviews, stats] = await Promise.all([
    getReviews(5),
    statsProp ? Promise.resolve(statsProp) : getReviewStats(),
  ]);
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
            <span>{stats.average} ({stats.count})</span>
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
              <Link href="/dashboard/reviews">View all reviews & write yours</Link>
            </Button>
          </>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-3">
              No reviews yet — be the first to share your experience!
            </p>
            <Button asChild>
              <Link href="/dashboard/reviews">Write a review</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
