import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { GlassCard } from "@/components/shared/glass-card";
import { Badge } from "@/components/ui/badge";
import { requirePermission } from "@/lib/data/admin";
import { adminDb } from "@/lib/actions/admin/core";
import { AIBlogGeneratorCard } from "@/components/admin/ai-blog-generator-card";

export const metadata: Metadata = { title: "AI Auto Blog" };

export default async function AdminAIBlogPage() {
  await requirePermission("cms.manage");
  const db = adminDb();

  const { data: posts } = await db
    .from("blog_posts")
    .select("id, slug, title, excerpt, status, published_at, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  const publishedCount = (posts ?? []).filter((p) => p.status === "published").length;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <AdminPageHeader
        title="AI Auto Blog Engine"
        description="Automated AI-powered SEO content generator. Craft high-ranking articles with auto keywords, JSON-LD Schema, and instant Telegram broadcasting."
      />

      {/* Top Metrics Grid */}
      <GlassCard className="p-5">
        <p className="text-xs text-muted-foreground">Published posts on file</p>
        <p className="mt-2 text-3xl font-extrabold tabular-nums">{publishedCount}</p>
      </GlassCard>

      {/* Trigger & Configuration Card */}
      <AIBlogGeneratorCard />

      {/* Recent Blog Posts List */}
      <GlassCard className="p-6">
        <h3 className="text-md font-bold text-foreground mb-4">Recent Published Blog Posts</h3>
        <div className="divide-y divide-border/50">
          {(posts ?? []).length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No blog posts found. Generate your first post above!</p>
          ) : (
            (posts ?? []).map((post) => (
              <div key={post.id} className="flex flex-col sm:flex-row sm:items-center justify-between py-3 gap-2">
                <div>
                  <a
                    href={`/blog/${post.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-foreground hover:text-ws-green transition-colors"
                  >
                    {post.title}
                  </a>
                  <p className="text-xs text-muted-foreground line-clamp-1">{post.excerpt || post.slug}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={post.status === "published" ? "default" : "secondary"}>
                    {post.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {post.published_at ? new Date(post.published_at).toLocaleDateString() : "Draft"}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </GlassCard>
    </div>
  );
}
