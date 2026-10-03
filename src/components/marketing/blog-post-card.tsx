import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";

import { BlogCoverImage } from "@/components/marketing/blog-cover-image";
import type { MarketingPost } from "@/lib/data/marketing";

type BlogPostCardProps = {
  post: MarketingPost;
  dateFormat?: "short" | "long";
};

function formatDate(iso: string | null, style: "short" | "long") {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(
    "en-US",
    style === "long"
      ? { month: "long", day: "numeric", year: "numeric" }
      : { month: "short", day: "numeric", year: "numeric" }
  );
}

export function BlogPostCard({ post, dateFormat = "short" }: BlogPostCardProps) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-white/5 bg-[#1a1a1a] transition-all hover:border-orange-500/30 hover:-translate-y-1"
    >
      <div className="relative h-36 w-full overflow-hidden bg-[#141414] sm:h-40 md:h-44">
        {post.cover_image_url ? (
          <BlogCoverImage src={post.cover_image_url} alt={post.title} variant="card" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <BookOpen className="h-10 w-10 text-white/15" aria-hidden />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <h2 className="line-clamp-2 text-base font-bold text-foreground transition-colors group-hover:text-orange-400">
          {post.title}
        </h2>
        {post.excerpt && (
          <p className="line-clamp-2 flex-1 text-sm text-muted-foreground">{post.excerpt}</p>
        )}
        <div className="mt-auto flex items-center justify-between pt-2">
          {post.published_at && (
            <time dateTime={post.published_at} className="text-xs text-muted-foreground">
              {formatDate(post.published_at, dateFormat)}
            </time>
          )}
          <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-400">
            Read more <ArrowRight className="size-3" aria-hidden />
          </span>
        </div>
      </div>
    </Link>
  );
}
