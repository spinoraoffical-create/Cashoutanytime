import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminEmptyState } from "@/components/admin/ui/admin-empty-state";
import { AdminSectionCard } from "@/components/admin/ui/admin-section-card";
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
        title="Reviews"
        description="Reviews players already submitted. Like still features a review. The team reply and delete still use the existing actions. This page does not create a review."
      />

      <AdminSectionCard
        title="Player reviews"
        description={`${rows.length} stored. ${likedCount} liked, and those stay first on the public page.`}
      >
        {rows.length === 0 ? (
          <AdminEmptyState title="No player reviews yet" body="Reviews submitted from a player account will show here." />
        ) : (
          <div className="space-y-4">
            {rows.map((review) => (
              <ReviewCard key={review.id} review={review} isAdmin />
            ))}
          </div>
        )}
      </AdminSectionCard>
    </div>
  );
}
