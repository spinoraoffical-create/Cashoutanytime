import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { InternalLink } from "@/lib/seo/blog-links";

export function InternalCtas({
  links,
  title = "Continue on Sweepstakes Hub",
}: {
  links: InternalLink[];
  title?: string;
}) {
  if (links.length === 0) return null;
  return (
    <section className="mt-10 rounded-2xl border border-white/10 bg-[#141414] p-5">
      <h2 className="text-xl font-bold">{title}</h2>
      <div className="mt-4 flex flex-wrap gap-3">
        {links.map((link, index) => (
          <Button key={link.href + link.label} asChild variant={index === 0 ? "default" : "outline"}>
            <Link href={link.href}>{link.label}</Link>
          </Button>
        ))}
      </div>
    </section>
  );
}

export function RelatedGuides({
  posts,
}: {
  posts: { slug: string; title: string }[];
}) {
  if (posts.length === 0) return null;
  return (
    <section className="mt-8">
      <h2 className="text-xl font-bold">More guides</h2>
      <ul className="mt-4 space-y-3">
        {posts.map((post) => (
          <li key={post.slug}>
            <Link href={`/blog/${post.slug}`} className="font-semibold text-primary hover:underline">
              {post.title}
            </Link>
          </li>
        ))}
        <li>
          <Link href="/blog" className="text-sm font-semibold text-primary hover:underline">
            All guides
          </Link>
        </li>
      </ul>
    </section>
  );
}
