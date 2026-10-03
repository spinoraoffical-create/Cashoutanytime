import { VIP_TIERS } from "@/lib/constants";
import type { ReviewWithAuthor } from "@/types/database";

export function formatReviewDisplayName(review: ReviewWithAuthor): string {
  const fullName = review.author?.full_name?.trim();
  if (fullName) {
    const parts = fullName.split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0]} ${parts[parts.length - 1][0]}.`;
    }
    return parts[0];
  }

  const email = review.author?.email ?? "";
  if (email && !email.endsWith("@phone.spinora.local")) {
    const local = email.split("@")[0];
    return local.charAt(0).toUpperCase() + local.slice(1);
  }

  return "Spinora Player";
}

export function formatReviewVipTier(review: ReviewWithAuthor): string {
  const tierId = review.author?.vip_tier ?? "bronze";
  const tier = VIP_TIERS.find((t) => t.id === tierId);
  return `${tier?.name ?? "Bronze"} VIP`;
}

export function sortReviewsForDisplay<T extends { admin_liked: boolean; created_at: string }>(
  reviews: T[]
): T[] {
  return [...reviews].sort((a, b) => {
    if (a.admin_liked !== b.admin_liked) return a.admin_liked ? -1 : 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}
