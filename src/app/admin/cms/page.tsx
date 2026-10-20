import type { Metadata } from "next";
import Link from "next/link";

import {
  BlogPostCreateDialog,
  BlogPostDeleteButton,
  BlogPostEditDialog,
} from "@/components/admin/blog-post-edit-dialog";
import { CmsTabNav } from "@/components/admin/cms-tab-nav";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ConfirmActionButton } from "@/components/admin/confirm-action-button";
import {
  EntityEditDialog,
  type FieldValue,
} from "@/components/admin/entity-edit-dialog";
import { AdminStatusBadge } from "@/components/admin/ui/admin-status-badge";
import { formatNepalInputValue } from "@/lib/admin/nepal-time";
import { adminDb } from "@/lib/actions/admin/core";
import {
  deleteCmsEntityAction,
  upsertAnnouncementAction,
  upsertBannerAction,
  upsertFaqAction,
  upsertTestimonialAction,
} from "@/lib/actions/admin/cms";
import { requirePermission } from "@/lib/data/admin";

export const metadata: Metadata = { title: "CMS" };

const TABS = [
  { key: "faq", label: "FAQ" },
  { key: "banners", label: "Banners" },
  { key: "announcements", label: "Announcements" },
  { key: "testimonials", label: "Testimonials" },
  { key: "blog", label: "Blog" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default async function AdminCmsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string }>;
}) {
  await requirePermission("cms.manage");
  const params = await searchParams;
  const tab = (TABS.find((t) => t.key === params.tab)?.key ?? "faq") as TabKey;
  const blogPage = Math.max(1, Number(params.page) || 1);
  const db = adminDb();

  return (
    <div className="mx-auto max-w-7xl">
      <AdminPageHeader
        title="Pages and FAQ"
        description="FAQ, banners, announcements, testimonials, and blog posts already stored. Nothing is published until you save it. Delete still asks you to confirm."
      />

      <CmsTabNav active={tab} />

      {tab === "faq" && <FaqSection db={db} />}
      {tab === "banners" && <BannersSection db={db} />}
      {tab === "announcements" && <AnnouncementsSection db={db} />}
      {tab === "testimonials" && <TestimonialsSection db={db} />}
      {tab === "blog" && <BlogSection db={db} page={blogPage} />}
    </div>
  );
}

type DB = ReturnType<typeof adminDb>;

/* ── FAQ ──────────────────────────────────────────────────────────────────── */
async function FaqSection({ db }: { db: DB }) {
  const { data } = await db
    .from("faqs")
    .select("id, question, answer, category, sort_order, is_published")
    .order("category")
    .order("sort_order");
  const faqs = data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <EntityEditDialog
          title="New FAQ"
          triggerLabel="New FAQ"
          fields={[
            { name: "question", label: "Question", type: "text", defaultValue: "" },
            { name: "answer", label: "Answer", type: "textarea", defaultValue: "" },
            { name: "category", label: "Category", type: "text", defaultValue: "general" },
            { name: "sort_order", label: "Sort order", type: "number", defaultValue: 100, min: 0 },
            { name: "is_published", label: "Published", type: "switch", defaultValue: false },
          ]}
          action={async (v: Record<string, FieldValue>) => {
            "use server";
            return upsertFaqAction({
              question: String(v.question),
              answer: String(v.answer),
              category: String(v.category),
              sort_order: Number(v.sort_order),
              is_published: Boolean(v.is_published),
            });
          }}
        />
      </div>
      <div className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-[#7c3aed]/25 bg-[#0d1428]">
        {faqs.length === 0 ? (
          <p className="p-6 text-center text-sm text-[#9fb0d0]">No FAQs yet.</p>
        ) : (
          faqs.map((f) => (
            <div key={f.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{f.question}</p>
                  {!f.is_published && (
                    <AdminStatusBadge status="draft" />
                  )}
                </div>
                <p className="mt-0.5 line-clamp-2 text-xs text-[#9fb0d0]">
                  {f.answer}
                </p>
                <p className="mt-1 text-xs text-[#8ea0c3]">{f.category}</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-1">
                <EntityEditDialog
                  title="Edit FAQ"
                  fields={[
                    { name: "question", label: "Question", type: "text", defaultValue: f.question },
                    { name: "answer", label: "Answer", type: "textarea", defaultValue: f.answer },
                    { name: "category", label: "Category", type: "text", defaultValue: f.category },
                    { name: "sort_order", label: "Sort order", type: "number", defaultValue: f.sort_order, min: 0 },
                    { name: "is_published", label: "Published", type: "switch", defaultValue: f.is_published },
                  ]}
                  action={async (v: Record<string, FieldValue>) => {
                    "use server";
                    return upsertFaqAction({
                      id: f.id,
                      question: String(v.question),
                      answer: String(v.answer),
                      category: String(v.category),
                      sort_order: Number(v.sort_order),
                      is_published: Boolean(v.is_published),
                    });
                  }}
                />
                <ConfirmActionButton
                  action={deleteCmsEntityAction.bind(null, "faqs", f.id)}
                  title="Delete FAQ?"
                  description="This FAQ will be removed from the public site."
                  confirmLabel="Delete"
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ── Banners ──────────────────────────────────────────────────────────────── */
async function BannersSection({ db }: { db: DB }) {
  const { data } = await db
    .from("banners")
    .select("id, title, subtitle, image_url, link_url, placement, is_active, priority, starts_at, ends_at")
    .order("placement")
    .order("priority");
  const banners = data ?? [];

  const placementOptions = [
    { value: "home_hero", label: "Home hero" },
    { value: "home_strip", label: "Home strip" },
    { value: "dashboard", label: "Dashboard" },
    { value: "promotions_page", label: "Promotions page" },
    { value: "home_popup", label: "Home popup" },
  ];

  const toLocalInput = (v: string | null) => formatNepalInputValue(v);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <EntityEditDialog
          title="New banner"
          triggerLabel="New banner"
          fields={[
            { name: "title", label: "Title", type: "text", defaultValue: "" },
            { name: "subtitle", label: "Subtitle", type: "text", defaultValue: "" },
            { name: "image_url", label: "Image URL (Supabase)", type: "text", defaultValue: "" },
            { name: "link_url", label: "Link URL", type: "text", defaultValue: "" },
            { name: "placement", label: "Placement", type: "select", defaultValue: "home_strip", options: placementOptions },
            { name: "priority", label: "Priority", type: "number", defaultValue: 100, min: 0 },
            { name: "is_active", label: "Active", type: "switch", defaultValue: false },
            { name: "starts_at", label: "Starts at (Nepal time)", type: "datetime-local", defaultValue: "" },
            { name: "ends_at", label: "Ends at (Nepal time)", type: "datetime-local", defaultValue: "" },
          ]}
          action={async (v: Record<string, FieldValue>) => {
            "use server";
            return upsertBannerAction({
              title: String(v.title),
              subtitle: String(v.subtitle),
              image_url: String(v.image_url),
              link_url: String(v.link_url),
              placement: v.placement as "home_hero" | "home_strip" | "dashboard" | "promotions_page" | "home_popup",
              priority: Number(v.priority),
              is_active: Boolean(v.is_active),
              starts_at: String(v.starts_at),
              ends_at: String(v.ends_at),
            });
          }}
        />
      </div>
      <div className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-[#7c3aed]/25 bg-[#0d1428]">
        {banners.length === 0 ? (
          <p className="p-6 text-center text-sm text-[#9fb0d0]">No banners yet.</p>
        ) : (
          banners.map((b) => (
            <div key={b.id} className="flex items-start justify-between gap-4 p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{b.title}</p>
                  <AdminStatusBadge status={b.is_active ? "active" : "off"} />
                </div>
                <p className="mt-0.5 text-xs text-[#9fb0d0]">{b.subtitle}</p>
                <p className="mt-1 text-xs text-[#8ea0c3]">{b.placement}</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-1">
                <EntityEditDialog
                  title="Edit banner"
                  fields={[
                    { name: "title", label: "Title", type: "text", defaultValue: b.title },
                    { name: "subtitle", label: "Subtitle", type: "text", defaultValue: b.subtitle ?? "" },
                    { name: "image_url", label: "Image URL (Supabase)", type: "text", defaultValue: b.image_url ?? "" },
                    { name: "link_url", label: "Link URL", type: "text", defaultValue: b.link_url ?? "" },
                    { name: "placement", label: "Placement", type: "select", defaultValue: b.placement, options: placementOptions },
                    { name: "priority", label: "Priority", type: "number", defaultValue: b.priority, min: 0 },
                    { name: "is_active", label: "Active", type: "switch", defaultValue: b.is_active },
                    { name: "starts_at", label: "Starts at (Nepal time)", type: "datetime-local", defaultValue: toLocalInput(b.starts_at) },
                    { name: "ends_at", label: "Ends at (Nepal time)", type: "datetime-local", defaultValue: toLocalInput(b.ends_at) },
                  ]}
                  action={async (v: Record<string, FieldValue>) => {
                    "use server";
                    return upsertBannerAction({
                      id: b.id,
                      title: String(v.title),
                      subtitle: String(v.subtitle),
                      image_url: String(v.image_url),
                      link_url: String(v.link_url),
                      placement: v.placement as "home_hero" | "home_strip" | "dashboard" | "promotions_page" | "home_popup",
                      priority: Number(v.priority),
                      is_active: Boolean(v.is_active),
                      starts_at: String(v.starts_at),
                      ends_at: String(v.ends_at),
                    });
                  }}
                />
                <ConfirmActionButton
                  action={deleteCmsEntityAction.bind(null, "banners", b.id)}
                  title="Delete banner?"
                  description="This banner will be removed."
                  confirmLabel="Delete"
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ── Announcements ────────────────────────────────────────────────────────── */
async function AnnouncementsSection({ db }: { db: DB }) {
  const { data } = await db
    .from("announcements")
    .select("id, title, body, level, is_active")
    .order("created_at", { ascending: false });
  const announcements = data ?? [];

  const levelOptions = [
    { value: "info", label: "Info" },
    { value: "success", label: "Success" },
    { value: "warning", label: "Warning" },
    { value: "critical", label: "Critical" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <EntityEditDialog
          title="New announcement"
          triggerLabel="New announcement"
          fields={[
            { name: "title", label: "Title", type: "text", defaultValue: "" },
            { name: "body", label: "Body", type: "textarea", defaultValue: "" },
            { name: "level", label: "Level", type: "select", defaultValue: "info", options: levelOptions },
            { name: "is_active", label: "Active", type: "switch", defaultValue: false },
          ]}
          action={async (v: Record<string, FieldValue>) => {
            "use server";
            return upsertAnnouncementAction({
              title: String(v.title),
              body: String(v.body),
              level: v.level as "info" | "success" | "warning" | "critical",
              is_active: Boolean(v.is_active),
            });
          }}
        />
      </div>
      <div className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-[#7c3aed]/25 bg-[#0d1428]">
        {announcements.length === 0 ? (
          <p className="p-6 text-center text-sm text-[#9fb0d0]">
            No announcements yet.
          </p>
        ) : (
          announcements.map((a) => (
            <div key={a.id} className="flex items-start justify-between gap-4 p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{a.title}</p>
                  <span className="inline-flex rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold uppercase text-[#d5def2]">{a.level}</span>
                  {a.is_active ? <AdminStatusBadge status="live" /> : null}
                </div>
                <p className="mt-0.5 line-clamp-2 text-xs text-[#9fb0d0]">
                  {a.body}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-1">
                <EntityEditDialog
                  title="Edit announcement"
                  fields={[
                    { name: "title", label: "Title", type: "text", defaultValue: a.title },
                    { name: "body", label: "Body", type: "textarea", defaultValue: a.body },
                    { name: "level", label: "Level", type: "select", defaultValue: a.level, options: levelOptions },
                    { name: "is_active", label: "Active", type: "switch", defaultValue: a.is_active },
                  ]}
                  action={async (v: Record<string, FieldValue>) => {
                    "use server";
                    return upsertAnnouncementAction({
                      id: a.id,
                      title: String(v.title),
                      body: String(v.body),
                      level: v.level as "info" | "success" | "warning" | "critical",
                      is_active: Boolean(v.is_active),
                    });
                  }}
                />
                <ConfirmActionButton
                  action={deleteCmsEntityAction.bind(null, "announcements", a.id)}
                  title="Delete announcement?"
                  description="This announcement will be removed."
                  confirmLabel="Delete"
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ── Testimonials ─────────────────────────────────────────────────────────── */
async function TestimonialsSection({ db }: { db: DB }) {
  const { data } = await db
    .from("testimonials")
    .select("id, author_name, author_title, quote, rating, is_featured, is_published, sort_order")
    .order("sort_order");
  const testimonials = data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <EntityEditDialog
          title="New testimonial"
          triggerLabel="New testimonial"
          fields={[
            { name: "author_name", label: "Author name", type: "text", defaultValue: "" },
            { name: "author_title", label: "Author title", type: "text", defaultValue: "" },
            { name: "quote", label: "Quote", type: "textarea", defaultValue: "" },
            { name: "rating", label: "Rating (1-5)", type: "number", defaultValue: 5, min: 1 },
            { name: "sort_order", label: "Sort order", type: "number", defaultValue: 100, min: 0 },
            { name: "is_featured", label: "Featured", type: "switch", defaultValue: false },
            { name: "is_published", label: "Published", type: "switch", defaultValue: false },
          ]}
          action={async (v: Record<string, FieldValue>) => {
            "use server";
            return upsertTestimonialAction({
              author_name: String(v.author_name),
              author_title: String(v.author_title),
              quote: String(v.quote),
              rating: Number(v.rating),
              sort_order: Number(v.sort_order),
              is_featured: Boolean(v.is_featured),
              is_published: Boolean(v.is_published),
            });
          }}
        />
      </div>
      <div className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-[#7c3aed]/25 bg-[#0d1428]">
        {testimonials.length === 0 ? (
          <p className="p-6 text-center text-sm text-[#9fb0d0]">
            No testimonials yet.
          </p>
        ) : (
          testimonials.map((t) => (
            <div key={t.id} className="flex items-start justify-between gap-4 p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{t.author_name}</p>
                  <span className="tnum text-xs text-ws-green-deep dark:text-ws-green">{t.rating}★</span>
                  {t.is_featured && (
                    <AdminStatusBadge status="featured" />
                  )}
                  {!t.is_published && (
                    <AdminStatusBadge status="draft" />
                  )}
                </div>
                <p className="mt-0.5 line-clamp-2 text-xs text-[#9fb0d0]">
                  “{t.quote}”
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-1">
                <EntityEditDialog
                  title="Edit testimonial"
                  fields={[
                    { name: "author_name", label: "Author name", type: "text", defaultValue: t.author_name },
                    { name: "author_title", label: "Author title", type: "text", defaultValue: t.author_title },
                    { name: "quote", label: "Quote", type: "textarea", defaultValue: t.quote },
                    { name: "rating", label: "Rating (1-5)", type: "number", defaultValue: t.rating, min: 1 },
                    { name: "sort_order", label: "Sort order", type: "number", defaultValue: t.sort_order, min: 0 },
                    { name: "is_featured", label: "Featured", type: "switch", defaultValue: t.is_featured },
                    { name: "is_published", label: "Published", type: "switch", defaultValue: t.is_published },
                  ]}
                  action={async (v: Record<string, FieldValue>) => {
                    "use server";
                    return upsertTestimonialAction({
                      id: t.id,
                      author_name: String(v.author_name),
                      author_title: String(v.author_title),
                      quote: String(v.quote),
                      rating: Number(v.rating),
                      sort_order: Number(v.sort_order),
                      is_featured: Boolean(v.is_featured),
                      is_published: Boolean(v.is_published),
                    });
                  }}
                />
                <ConfirmActionButton
                  action={deleteCmsEntityAction.bind(null, "testimonials", t.id)}
                  title="Delete testimonial?"
                  description="This testimonial will be removed."
                  confirmLabel="Delete"
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ── Blog ─────────────────────────────────────────────────────────────────── */

function blogStatusBadge(status: string) {
  const label = status === "published" || status === "scheduled" || status === "archived" ? status : "draft";
  return <AdminStatusBadge status={label} />;
}

async function BlogSection({ db, page }: { db: DB; page: number }) {
  const PAGE_SIZE = 20;
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, count } = await db
    .from("blog_posts")
    .select("id, slug, title, excerpt, status, published_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  const posts = data ?? [];
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <BlogPostCreateDialog />
      </div>
      <div className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-[#7c3aed]/25 bg-[#0d1428]">
        {posts.length === 0 ? (
          <p className="p-6 text-center text-sm text-[#9fb0d0]">No posts yet.</p>
        ) : (
          posts.map((p) => (
            <div
              key={p.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{p.title}</p>
                  {blogStatusBadge(p.status)}
                </div>
                <p className="mt-0.5 line-clamp-1 text-xs text-[#9fb0d0]">{p.excerpt}</p>
                <p className="mt-1 text-xs text-[#8ea0c3]">/{p.slug}</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-1">
                <BlogPostEditDialog postId={p.id} />
                <BlogPostDeleteButton postId={p.id} />
              </div>
            </div>
          ))
        )}
      </div>
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[#9fb0d0]">
          <p>
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/admin/cms?tab=blog&page=${page - 1}`}
                className="rounded-lg border border-border px-3 py-1.5 hover:bg-foreground/5"
              >
                Prev
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`/admin/cms?tab=blog&page=${page + 1}`}
                className="rounded-lg border border-border px-3 py-1.5 hover:bg-foreground/5"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
