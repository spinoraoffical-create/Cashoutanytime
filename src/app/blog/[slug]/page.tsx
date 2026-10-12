import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { VipPageLayout } from "@/components/layout/vip-page-layout";
import { BlogCoverImage } from "@/components/marketing/blog-cover-image";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { getBlogPost, getPublishedBlogPosts } from "@/lib/data/marketing";
import { articleCtas, gamesInText, keepInternalHtml } from "@/lib/seo/blog-links";
import { InternalCtas, RelatedGuides } from "@/components/blog/internal-ctas";

// Heavy Traffic Optimization: 1-Hour Edge Caching for Sub-30ms Global Response Time
export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) return { title: "Post not found" };

  const fullUrl = `${SITE_URL}/blog/${slug}`;
  const imageUrl = post.cover_image_url || `${SITE_URL}/logo.webp`;

  return {
    title: `${post.seo_title ?? post.title} | Sweepstakes Hub`,
    description: post.seo_description ?? post.excerpt ?? undefined,
    alternates: { canonical: `/blog/${slug}` },
    openGraph: {
      title: post.seo_title ?? post.title,
      description: post.seo_description ?? post.excerpt ?? undefined,
      url: fullUrl,
      images: [{ url: imageUrl, width: 1200, height: 630 }],
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: post.seo_title ?? post.title,
      description: post.seo_description ?? post.excerpt ?? undefined,
      images: [imageUrl],
    },
  };
}

function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) notFound();

  // Google Rich Snippet JSON-LD Schema
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt || post.title,
    image: post.cover_image_url ? [post.cover_image_url] : [],
    datePublished: post.published_at || new Date().toISOString(),
    author: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/logo.webp`,
      },
    },
    mainEntityOfPage: `${SITE_URL}/blog/${slug}`,
  };

  const body = keepInternalHtml(post.content ?? post.excerpt ?? "");
  const topic = `${post.title} ${post.excerpt ?? ""} ${(post.tags ?? []).join(" ")}`;
  const mentioned = gamesInText(topic);
  const allPosts = await getPublishedBlogPosts();
  const related = allPosts
    .filter((item) => item.slug !== post.slug)
    .filter((item) => {
      const itemText = `${item.title} ${(item.tags ?? []).join(" ")}`.toLowerCase();
      return mentioned.some((game) => itemText.includes(game.label.toLowerCase()));
    });
  const moreGuides = (related.length ? related : allPosts.filter((item) => item.slug !== post.slug)).slice(0, 3);
  const primaryGame = mentioned[0];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <VipPageLayout>
        <main className="pb-16">
          <article className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <Breadcrumbs
            items={[
              { name: "Home", href: "/" },
              { name: "Blog", href: "/blog" },
              { name: post.title },
            ]}
          />

          <Link href="/blog" className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Back to blog
          </Link>

          {post.cover_image_url && (
            <div className="relative mb-8 aspect-video w-full overflow-hidden rounded-2xl bg-[#141414]">
              <BlogCoverImage src={post.cover_image_url} alt={post.title} priority variant="hero" />
            </div>
          )}

          <header className="mb-8">
            {post.published_at && (
              <time dateTime={post.published_at} className="text-sm text-muted-foreground">
                {formatDate(post.published_at)}
              </time>
            )}
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{post.title}</h1>
            {post.excerpt && <p className="mt-4 text-lg text-muted-foreground">{post.excerpt}</p>}
          </header>

          <div
            className="prose prose-invert max-w-none prose-p:text-muted-foreground prose-headings:text-white prose-a:font-semibold prose-a:text-primary"
            dangerouslySetInnerHTML={{ __html: body }}
          />
          <p className="mt-8 text-base leading-7 text-muted-foreground">
            {primaryGame ? (
              <>
                Play <Link href={primaryGame.href} className="font-semibold text-primary hover:underline">{primaryGame.label}</Link> in{" "}
                <Link href="/play" className="font-semibold text-primary hover:underline">Game Rooms</Link>.
              </>
            ) : (
              <>
                Open <Link href="/play" className="font-semibold text-primary hover:underline">Game Rooms</Link> to pick a game.
              </>
            )}{" "}
            <Link href="/register" className="font-semibold text-primary hover:underline">Create an account</Link>, then review{" "}
            <Link href="/promotions" className="font-semibold text-primary hover:underline">promotions</Link> and{" "}
            <Link href="/help" className="font-semibold text-primary hover:underline">wallet help</Link>.
          </p>
          <InternalCtas links={articleCtas(topic)} />
          <RelatedGuides posts={moreGuides.map((item) => ({ slug: item.slug, title: item.title }))} />
          </article>
        </main>
      </VipPageLayout>
    </>
  );
}
