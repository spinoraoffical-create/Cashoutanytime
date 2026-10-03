"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  readonly?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function StarRating({
  value,
  onChange,
  readonly = false,
  size = "md",
  className,
}: StarRatingProps) {
  const iconSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <div
      className={cn("flex items-center gap-0.5", className)}
      role={readonly ? "img" : "group"}
      aria-label={readonly ? `${value} out of 5 stars` : "Rate from 1 to 5 stars"}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= value;
        const StarEl = readonly ? "span" : "button";

        return (
          <StarEl
            key={star}
            {...(!readonly && {
              type: "button" as const,
              onClick: () => onChange?.(star),
            })}
            className={cn(
              "transition-transform",
              !readonly && "hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 rounded"
            )}
            aria-label={readonly ? undefined : `${star} star${star > 1 ? "s" : ""}`}
          >
            <Star
              className={cn(
                iconSize,
                filled ? "fill-amber-400 text-amber-400" : "text-white/25"
              )}
            />
          </StarEl>
        );
      })}
    </div>
  );
}
