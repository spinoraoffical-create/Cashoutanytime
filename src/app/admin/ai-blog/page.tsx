import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminSectionCard } from "@/components/admin/ui/admin-section-card";
import { AdminStatCard } from "@/components/admin/ui/admin-stat-card";
import { AdminStatusBadge } from "@/components/admin/ui/admin-status-badge";
import { AdminEmptyState } from "@/components/admin/ui/admin-empty-state";
import { requirePermission } from "@/lib/data/admin";
import { adminDb } from "@/lib/actions/admin/core";
import { AIBlogGeneratorCard } from "@/components/admin/ai-blog-generator-card";
import { formatNepalTime } from "@/lib/admin/nepal-time";
import { blogStatusHelp } from "@/lib/admin/marketing-status";

export const metadata: Metadata = { title: "AI Auto Blog" };

export default async function AdminAIBlogPage() {
  await requirePermission("cms.manage");
  const db = adminDb();

  const { data: posts } = await db
    .from("blog_posts")
    .select("id, slug, title, excerpt, status, published_at, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  const loaded = posts ?? [];
  const publishedCount = loaded.filter((p) => p.status === "published").length;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <AdminPageHeader
        title="AI blog"
        description="Opening this page does not generate or publish. The generate control below still uses the existing action, and that action can publish. Stored post statuses are draft, scheduled, published, and archived."
      />

      <AdminStatCard
        label="Published in this list"
        value={String(publishedCount)}
        hint="This counts published rows among the 10 newest posts loaded here."
      />

      <AIBlogGeneratorCard />

      <AdminSectionCard title="Newest posts" description="This list is for reading. It does not publish.">
        {loaded.length === 0 ? (
          <AdminEmptyState title="No blog posts in this list" body="A post appears here after the existing generate control creates one." />
        ) : (
          <div className="divide-y divide-white/10">
            {loaded.map((post) => (
              <div key={post.id} className="flex flex-col justify-between gap-2 py-3 sm:flex-row sm:items-center">
                <div>
                  <a href={`/blog/${post.slug}`} target="_blank" rel="noreferrer" className="font-medium text-white hover:text-sky-200">
                    {post.title}
                  </a>
                  <p className="line-clamp-1 text-xs text-[#9fb0d0]">{post.excerpt || post.slug}</p>
                </div>
                <div className="shrink-0">
                  <AdminStatusBadge status={post.status} />
                  <p className="mt-1 text-xs text-[#9fb0d0]">{blogStatusHelp(post.status)}</p>
                  <p className="text-xs text-[#8ea0c3]">
                    {post.published_at ? formatNepalTime(post.published_at) : "No publish date"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </AdminSectionCard>
    </div>
  );
}
