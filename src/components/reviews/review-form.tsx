"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Pencil } from "lucide-react";
import { StarRating } from "@/components/reviews/star-rating";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitReview } from "@/lib/actions/reviews";
import { toast } from "sonner";
import type { Review } from "@/types/database";

interface ReviewFormProps {
  existingReview?: Review | null;
}

export function ReviewForm({ existingReview }: ReviewFormProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(!existingReview);
  const [rating, setRating] = useState(existingReview?.rating ?? 0);
  const [comment, setComment] = useState(existingReview?.comment ?? "");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating < 1) {
      toast.error("Please tap the stars to rate your experience");
      return;
    }

    setLoading(true);
    const result = await submitReview(rating, comment);
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    if (result.isNew) {
      toast.success("Review submitted! Check Messages for a thank-you from our team.");
    } else {
      toast.success("Review updated!");
    }

    setEditing(false);
    router.refresh();
  }

  function handleCancelEdit() {
    if (existingReview) {
      setRating(existingReview.rating);
      setComment(existingReview.comment);
      setEditing(false);
    }
  }

  if (existingReview && !editing) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-white">Review submitted</p>
            <p className="text-xs text-muted-foreground mt-1">
              Thanks for sharing your feedback with the community.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Your rating</Label>
          <StarRating value={existingReview.rating} readonly />
          <p className="text-xs text-muted-foreground">
            {existingReview.rating} out of 5 stars
          </p>
        </div>

        <div className="space-y-2">
          <Label>Your review</Label>
          <p className="text-sm text-foreground/90 leading-relaxed rounded-lg border border-white/10 bg-[#1e1e1e] p-3 whitespace-pre-wrap break-words">
            {existingReview.comment}
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => setEditing(true)}
          className="gap-2"
        >
          <Pencil className="h-4 w-4" />
          Modify review
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Your rating</Label>
        <StarRating value={rating} onChange={setRating} />
        <p className="text-xs text-muted-foreground">
          {rating > 0 ? `${rating} out of 5 stars` : "Tap a star to rate"}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="review-comment">Your review</Label>
        <Textarea
          id="review-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Tell us about your experience with Spinora — support, games, VIP rewards..."
          rows={4}
          required
          minLength={3}
          maxLength={1000}
          className="bg-[#1e1e1e] border-white/10 resize-none"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={loading || rating < 1} className="w-full sm:w-auto">
          {loading
            ? "Submitting..."
            : existingReview
              ? "Save changes"
              : "Submit review"}
        </Button>
        {existingReview && (
          <Button type="button" variant="ghost" onClick={handleCancelEdit}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
