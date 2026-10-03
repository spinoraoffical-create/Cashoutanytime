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
      <div className="grid gap-4 sm:grid-cols-3">
        <GlassCard className="p-5">
          <p className="hud-label text-xs text-muted-foreground">Published AI Articles</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-ws-green">{publishedCount}</span>
            <Badge className="bg-ws-green/15 text-ws-green">SEO Active</Badge>
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <p className="hud-label text-xs text-muted-foreground">AI Generation Provider</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold text-foreground">Smart Auto / LLM</span>
            <Badge variant="outline">GPT-4o / Smart Fallback</Badge>
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <p className="hud-label text-xs text-muted-foreground">Telegram Auto Broadcast</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold text-emerald-400">Enabled</span>
            <Badge className="bg-emerald-500/15 text-emerald-400">Channel Sync</Badge>
          </div>
        </GlassCard>
      </div>

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
