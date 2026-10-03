"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/actions/notifications";
import { sortReviewsForDisplay } from "@/lib/reviews/display";
import type { ReviewWithAuthor } from "@/types/database";

const REVIEW_AUTHOR_SELECT =
  "*, author:profiles!reviews_user_id_fkey(full_name, email, avatar_url, vip_tier)";

const THANK_YOU_CHAT =
  "Thank you so much for sharing your review! ⭐ Your feedback helps us improve Spinora for everyone. We really appreciate you being part of our community — keep enjoying the games and message us anytime if you need help!";

async function sendReviewThankYouMessage(userId: string): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;

  const { data: adminProfile } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!adminProfile) return;

  let { data: conversation } = await admin
    .from("conversations")
    .select("id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (!conversation) {
    const { data: created } = await admin
      .from("conversations")
      .insert({ user_id: userId })
      .select("id")
      .single();
    conversation = created;
  }

  if (!conversation) return;

  await admin.from("messages").insert({
    conversation_id: conversation.id,
    sender_id: adminProfile.id,
    content: THANK_YOU_CHAT,
  });

  await admin
    .from("conversations")
    .update({ updated_at: new Date().toISOString(), admin_id: adminProfile.id })
    .eq("id", conversation.id);
}

export async function getReviews(limit = 50): Promise<ReviewWithAuthor[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reviews")
    .select(REVIEW_AUTHOR_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[reviews] fetch failed:", error.message);
    return [];
  }

  return (data ?? []) as ReviewWithAuthor[];
}

/** Public home-page feed — visible to all visitors (requires anon SELECT policy). */
export async function getPublicReviews(limit = 6): Promise<ReviewWithAuthor[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reviews")
    .select(REVIEW_AUTHOR_SELECT)
    .order("created_at", { ascending: false })
    .limit(Math.max(limit, 20));

  if (error) {
    console.error("[reviews] public fetch failed:", error.message);
    return [];
  }

  return sortReviewsForDisplay((data ?? []) as ReviewWithAuthor[]).slice(0, limit);
}

export async function getMyReview() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("reviews")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  return data;
}

export async function submitReview(rating: number, comment: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const stars = Math.round(rating);
  const text = comment.trim();

  if (stars < 1 || stars > 5) return { error: "Please select a rating from 1 to 5 stars" };
  if (text.length < 3) return { error: "Please write at least a few words in your review" };

  const { data: existing } = await supabase
    .from("reviews")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  const isNew = !existing;
  const now = new Date().toISOString();

  const payload: Record<string, unknown> = {
    user_id: user.id,
    rating: stars,
    comment: text,
  };

  if (isNew) {
    payload.admin_comment = THANK_YOU_CHAT;
    payload.admin_commented_at = now;
  }

  const { error } = await supabase.from("reviews").upsert(payload, { onConflict: "user_id" });

  if (error) {
    if (error.message.includes("reviews")) {
      return { error: "Reviews not set up yet. Run supabase/reviews.sql in Supabase SQL Editor." };
    }
    return { error: error.message };
  }

  if (isNew) {
    await createNotification(
      user.id,
      "Thanks for your review!",
      "We appreciate your feedback. Check Messages for a thank-you note from our team.",
      "success"
    );
    void sendReviewThankYouMessage(user.id);
  }

  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/reviews");
  revalidatePath("/admin/reviews");
  return { success: true, isNew };
}

export async function adminToggleReviewLike(reviewId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") return { error: "Unauthorized" };

  const { data: review } = await supabase
    .from("reviews")
    .select("admin_liked")
    .eq("id", reviewId)
    .single();

  if (!review) return { error: "Review not found" };

  const liked = !review.admin_liked;

  const { error } = await supabase
    .from("reviews")
    .update({
      admin_liked: liked,
      admin_liked_at: liked ? new Date().toISOString() : null,
    })
    .eq("id", reviewId);

  if (error) return { error: error.message };

  revalidatePath("/");
  revalidatePath("/dashboard/reviews");
  revalidatePath("/admin/reviews");
  return { success: true, liked };
}

export async function adminDeleteReview(reviewId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") return { error: "Unauthorized" };

  const { error } = await supabase.from("reviews").delete().eq("id", reviewId);

  if (error) return { error: error.message };

  revalidatePath("/");
  revalidatePath("/dashboard/reviews");
  revalidatePath("/admin/reviews");
  return { success: true };
}

export async function adminUpdateReviewComment(reviewId: string, comment: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") return { error: "Unauthorized" };

  const text = comment.trim();
  if (text.length < 3) return { error: "Comment must be at least a few words" };

  const { error } = await supabase
    .from("reviews")
    .update({
      admin_comment: text,
      admin_commented_at: new Date().toISOString(),
    })
    .eq("id", reviewId);

  if (error) return { error: error.message };

  revalidatePath("/");
  revalidatePath("/dashboard/reviews");
  revalidatePath("/admin/reviews");
  return { success: true };
}

export async function getReviewStats() {
  const supabase = await createClient();
  const [{ count }, { data: ratings }] = await Promise.all([
    supabase.from("reviews").select("*", { count: "exact", head: true }),
    supabase.from("reviews").select("rating"),
  ]);

  const total = count ?? 0;
  if (total === 0) return { count: 0, average: 0 };

  const rows = ratings ?? [];
  const sum = rows.reduce((acc, r) => acc + r.rating, 0);
  return {
    count: total,
    average: Math.round((sum / rows.length) * 10) / 10,
  };
}
