import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { GlassCard } from "@/components/shared/glass-card";
import { ReviewCard } from "@/components/reviews/review-card";
import { adminDb } from "@/lib/actions/admin/core";
import { requirePermission } from "@/lib/data/admin";
import type { ReviewWithAuthor } from "@/types/database";

export const metadata: Metadata = { title: "Reviews" };

const REVIEW_AUTHOR_SELECT =
  "id, user_id, rating, comment, admin_liked, admin_liked_at, admin_comment, admin_commented_at, created_at, updated_at, author:profiles!reviews_user_id_fkey(full_name, email, avatar_url, vip_tier)";

export default async function AdminReviewsPage() {
  await requirePermission("cms.manage");
  const db = adminDb();

  const { data: reviews } = await db
    .from("reviews")
    .select(REVIEW_AUTHOR_SELECT)
    .order("created_at", { ascending: false });

  const rows: ReviewWithAuthor[] = (reviews ?? []).map((row) => {
    const author = Array.isArray(row.author) ? row.author[0] ?? null : row.author;
    return { ...row, author } as ReviewWithAuthor;
  });
  const likedCount = rows.filter((r) => r.admin_liked).length;

  return (
    <div className="mx-auto max-w-3xl">
      <AdminPageHeader
        title="Player Reviews"
        description="Like reviews to feature them on the homepage (Team pick), reply as Spinora Team, or delete spam."
      />

      <div className="mb-4 flex gap-3 text-sm text-muted-foreground">
        <span>{rows.length} total</span>
        <span>·</span>
        <span>{likedCount} liked (shown first on homepage)</span>
      </div>

      <GlassCard className="p-4 sm:p-5">
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No player reviews yet. Reviews submitted from the dashboard appear here.
          </p>
        ) : (
          <div className="space-y-4">
            {rows.map((review) => (
              <ReviewCard key={review.id} review={review} isAdmin />
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
