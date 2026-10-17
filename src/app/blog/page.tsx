import Link from "next/link";
import { BookOpen } from "lucide-react";
import { VipPageLayout } from "@/components/layout/vip-page-layout";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { BlogPostCard } from "@/components/marketing/blog-post-card";
import { Card } from "@/components/ui/card";
import { getPublishedBlogPosts } from "@/lib/data/marketing";
import { withPageSocial } from "@/lib/seo/metadata";

export const revalidate = 300;

export const metadata = withPageSocial({
  title: "Game Guides, Bonuses & Tips | Sweepstakes Hub Blog",
  description: "Guides about Sweepstakes Hub Game Rooms, accounts, and the public rules pages.",
  path: "/blog",
});

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
              Everything you need to know about playing at Sweepstakes Hub — account setup, deposits, bonus claims and winning strategies.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 text-sm font-semibold">
              <Link href="/play" className="rounded-full border border-white/10 px-4 py-2 hover:border-orange-500/40">Game Rooms</Link>
              <Link href="/register" className="rounded-full border border-white/10 px-4 py-2 hover:border-orange-500/40">Create an account</Link>
              <Link href="/promotions" className="rounded-full border border-white/10 px-4 py-2 hover:border-orange-500/40">Promotions</Link>
              <Link href="/faq" className="rounded-full border border-white/10 px-4 py-2 hover:border-orange-500/40">FAQ</Link>
              <Link href="/help" className="rounded-full border border-white/10 px-4 py-2 hover:border-orange-500/40">Wallet help</Link>
            </div>
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
