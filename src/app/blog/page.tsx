import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import { VipPageLayout } from "@/components/layout/vip-page-layout";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { BlogPostCard } from "@/components/marketing/blog-post-card";
import { Card } from "@/components/ui/card";
import { getPublishedBlogPosts } from "@/lib/data/marketing";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Game Guides, Bonuses & Tips | Spinora Blog",
  description:
    "How-to guides on fish table games, deposits, bonuses and winning strategies at Spinora.",
  alternates: { canonical: "/blog" },
};

export default async function BlogPage() {
  const posts = await getPublishedBlogPosts();

  return (
    <VipPageLayout>
      <main className="pb-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Blog" }]} />

          <div className="mb-12 max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-orange-400 mb-2">Guides &amp; Tips</p>
            <h1 className="text-4xl font-bold mb-4">
              Game Guides, <span className="gradient-text">Bonuses &amp; Tips</span>
            </h1>
            <p className="text-muted-foreground text-lg">
              Everything you need to know about playing at Spinora — account setup, deposits, bonus claims and winning strategies.
            </p>
          </div>

          {posts.length === 0 ? (
            <Card className="py-20 text-center text-muted-foreground">
              <BookOpen className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p className="font-medium text-foreground">Game guides coming soon</p>
            </Card>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <BlogPostCard key={post.id} post={post} dateFormat="long" />
              ))}
            </div>
          )}
        </div>
      </main>
    </VipPageLayout>
  );
}
