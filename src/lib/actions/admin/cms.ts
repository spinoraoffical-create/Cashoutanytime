"use server";

import { randomUUID } from "crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";

import {
  AdminActionResult,
  adminDb,
  authorize,
  writeAudit,
} from "@/lib/actions/admin/core";
import { parseNepalLocalToUtc } from "@/lib/admin/nepal-time";

const PERMISSION = "cms.manage";

function revalidateGameCatalog() {
  revalidatePath("/admin/games");
  revalidatePath("/games");
  revalidatePath("/play");
  revalidatePath("/");
  revalidateTag("marketing-games");
}

function revalidateContent() {
  revalidatePath("/admin/cms");
  revalidatePath("/faq");
  revalidatePath("/");
}

// ── FAQs ─────────────────────────────────────────────────────────────────────

const faqSchema = z.object({
  question: z.string().trim().min(3).max(300),
  answer: z.string().trim().min(3).max(4000),
  category: z.string().trim().min(2).max(40),
  sort_order: z.number().int().min(0).max(9999),
  is_published: z.boolean(),
});

export async function upsertFaqAction(
  input: z.infer<typeof faqSchema> & { id?: string }
): Promise<AdminActionResult> {
  const auth = await authorize(PERMISSION);
  if ("error" in auth) return { ok: false, error: auth.error };

  const parsed = faqSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };

  const db = adminDb();
  const result = input.id
    ? await db.from("faqs").update(parsed.data).eq("id", input.id)
    : await db.from("faqs").insert(parsed.data);
  if (result.error) return { ok: false, error: "Could not save the FAQ." };

  await writeAudit({
    actorId: auth.staff.userId,
    action: input.id ? "faq.update" : "faq.create",
    entityType: "faq",
    entityId: input.id ?? null,
    after: parsed.data,
  });
  revalidateContent();
  return { ok: true, message: "FAQ saved." };
}

// ── Banners ──────────────────────────────────────────────────────────────────

function nepalInstant(raw: string | null | undefined): { ok: true; value: string | null } | { ok: false } {
  if (!raw) return { ok: true, value: null };
  const parsed = parseNepalLocalToUtc(raw);
  if (!parsed) return { ok: false };
  return { ok: true, value: parsed.toISOString() };
}

const bannerSchema = z.object({
  title: z.string().trim().min(3).max(120),
  subtitle: z.string().trim().max(200).optional().default(""),
  image_url: z.string().trim().max(500).optional().default(""),
  link_url: z.string().trim().max(200).optional().default(""),
  placement: z.enum(["home_hero", "home_strip", "dashboard", "promotions_page", "home_popup"]),
  is_active: z.boolean(),
  priority: z.number().int().min(0).max(9999),
  starts_at: z.string().trim().optional().default(""),
  ends_at: z.string().trim().optional().default(""),
});

export async function upsertBannerAction(
  input: z.infer<typeof bannerSchema> & { id?: string }
): Promise<AdminActionResult> {
  const auth = await authorize(PERMISSION);
  if ("error" in auth) return { ok: false, error: auth.error };

  const parsed = bannerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };

  const startsAt = nepalInstant(parsed.data.starts_at);
  const endsAt = nepalInstant(parsed.data.ends_at);
  if (!startsAt.ok || !endsAt.ok) {
    return { ok: false, error: "Enter a valid Nepal date and time, or leave the time blank." };
  }

  const payload = {
    ...parsed.data,
    subtitle: parsed.data.subtitle || null,
    image_url: parsed.data.image_url || null,
    link_url: parsed.data.link_url || null,
    starts_at: startsAt.value,
    ends_at: endsAt.value,
  };

  const db = adminDb();
  const result = input.id
    ? await db.from("banners").update(payload).eq("id", input.id)
    : await db.from("banners").insert(payload);
  if (result.error) return { ok: false, error: "Could not save the banner." };

  await writeAudit({
    actorId: auth.staff.userId,
    action: input.id ? "banner.update" : "banner.create",
    entityType: "banner",
    entityId: input.id ?? null,
    after: payload,
  });
  revalidateContent();
  revalidatePath("/dashboard");
  return { ok: true, message: "Banner saved." };
}

// ── Announcements ────────────────────────────────────────────────────────────

const announcementSchema = z.object({
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().max(1000).optional().default(""),
  level: z.enum(["info", "success", "warning", "critical"]),
  is_active: z.boolean(),
});

export async function upsertAnnouncementAction(
  input: z.infer<typeof announcementSchema> & { id?: string }
): Promise<AdminActionResult> {
  const auth = await authorize(PERMISSION);
  if ("error" in auth) return { ok: false, error: auth.error };

  const parsed = announcementSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };

  const db = adminDb();
  const payload = input.id
    ? parsed.data
    : { ...parsed.data, created_by: auth.staff.userId };
  const result = input.id
    ? await db.from("announcements").update(parsed.data).eq("id", input.id)
    : await db.from("announcements").insert(payload);
  if (result.error) return { ok: false, error: "Could not save the announcement." };

  await writeAudit({
    actorId: auth.staff.userId,
    action: input.id ? "announcement.update" : "announcement.create",
    entityType: "announcement",
    entityId: input.id ?? null,
    after: parsed.data,
  });
  revalidateContent();
  return { ok: true, message: "Announcement saved." };
}

// ── Testimonials ─────────────────────────────────────────────────────────────

const testimonialSchema = z.object({
  author_name: z.string().trim().min(2).max(80),
  author_title: z.string().trim().max(80).optional().default(""),
  quote: z.string().trim().min(5).max(500),
  rating: z.number().int().min(1).max(5),
  is_featured: z.boolean(),
  is_published: z.boolean(),
  sort_order: z.number().int().min(0).max(9999),
});

export async function upsertTestimonialAction(
  input: z.infer<typeof testimonialSchema> & { id?: string }
): Promise<AdminActionResult> {
  const auth = await authorize(PERMISSION);
  if ("error" in auth) return { ok: false, error: auth.error };

  const parsed = testimonialSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };

  const db = adminDb();
  const result = input.id
    ? await db.from("testimonials").update(parsed.data).eq("id", input.id)
    : await db.from("testimonials").insert(parsed.data);
  if (result.error) return { ok: false, error: "Could not save the testimonial." };

  await writeAudit({
    actorId: auth.staff.userId,
    action: input.id ? "testimonial.update" : "testimonial.create",
    entityType: "testimonial",
    entityId: input.id ?? null,
    after: parsed.data,
  });
  revalidateContent();
  return { ok: true, message: "Testimonial saved." };
}

// ── Generic delete for CMS entities ──────────────────────────────────────────

const DELETABLE = ["faqs", "banners", "announcements", "testimonials", "blog_posts", "geo_states", "geo_cities", "player_reviews"] as const;
type CmsTable = (typeof DELETABLE)[number];

export async function deleteCmsEntityAction(
  table: CmsTable,
  id: string
): Promise<AdminActionResult> {
  const auth = await authorize(PERMISSION);
  if ("error" in auth) return { ok: false, error: auth.error };
  if (!DELETABLE.includes(table)) return { ok: false, error: "Unknown entity." };

  const db = adminDb();
  const { error } = await db.from(table).delete().eq("id", id);
  if (error) return { ok: false, error: "Could not delete." };

  await writeAudit({
    actorId: auth.staff.userId,
    action: `${table}.delete`,
    entityType: table,
    entityId: id,
  });
  revalidateContent();
  return { ok: true, message: "Deleted." };
}

// ── Games ────────────────────────────────────────────────────────────────────

const gameSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and hyphens only")
    .min(2)
    .max(60)
    .optional(),
  description: z.string().trim().max(500).optional().default(""),
  image_url: z.string().trim().max(500).optional().default(""),
  play_url: z.string().trim().max(500).optional().default(""),
  download_url: z.string().trim().max(500).optional().default(""),
  badge_text: z.string().trim().max(20).optional().default(""),
  is_active: z.boolean(),
  is_featured: z.boolean(),
  is_live: z.boolean().optional().default(false),
  first_deposit_bonus_percent: z.coerce.number().min(0).max(200).optional().default(50),
  reload_bonus_percent: z.coerce.number().min(0).max(200).optional().default(10),
  bonus_text: z.string().trim().max(240).optional().default(""),
  bonus_enabled: z.boolean().optional().default(true),
  bonus_min_deposit: z.number().min(0).max(100000).nullable().optional(),
  bonus_max_amount: z.number().min(0).max(100000).nullable().optional(),
  bonus_starts_at: z.string().trim().max(40).nullable().optional(),
  bonus_ends_at: z.string().trim().max(40).nullable().optional(),
});

export async function upsertGameAction(
  input: z.infer<typeof gameSchema> & { id: string }
): Promise<AdminActionResult> {
  const auth = await authorize(PERMISSION);
  if ("error" in auth) return { ok: false, error: auth.error };

  const parsed = gameSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };

  const patch = {
    name: parsed.data.name,
    ...(parsed.data.slug ? { slug: parsed.data.slug } : {}),
    description: parsed.data.description || "",
    image_url: parsed.data.image_url || null,
    play_url: parsed.data.play_url || null,
    download_url: parsed.data.download_url || null,
    badge_text: parsed.data.badge_text || null,
    is_active: parsed.data.is_active,
    is_featured: parsed.data.is_featured,
    is_live: parsed.data.is_live,
    first_deposit_bonus_percent: parsed.data.first_deposit_bonus_percent,
    reload_bonus_percent: parsed.data.reload_bonus_percent,
    bonus_text: parsed.data.bonus_text || null,
  };

  const db = adminDb();
  const { error } = await db.from("games").update(patch).eq("id", input.id);
  if (error && /is_live|bonus_percent|bonus_text|schema cache|column/i.test(error.message)) {
    const { is_live: _live, first_deposit_bonus_percent: _first, reload_bonus_percent: _reload, bonus_text: _text, ...rest } = patch;
    const retry = await db.from("games").update(rest).eq("id", input.id);
    if (retry.error) return { ok: false, error: "Could not save the game." };
    revalidateGameCatalog();
    return { ok: true, message: "Saved the game. Apply 20261008000130_auto_ops.sql before bonus percents will store." };
  }
  if (error) return { ok: false, error: "Could not save the game." };

  await writeAudit({
    actorId: auth.staff.userId,
    action: "game.bonus_update",
    entityType: "game",
    entityId: input.id,
    after: patch,
  });

  const limits = {
    bonus_enabled: parsed.data.bonus_enabled,
    bonus_min_deposit: parsed.data.bonus_min_deposit ?? null,
    bonus_max_amount: parsed.data.bonus_max_amount ?? null,
    bonus_starts_at: parsed.data.bonus_starts_at || null,
    bonus_ends_at: parsed.data.bonus_ends_at || null,
  };
  const limitWrite = await db.from("games").update(limits).eq("id", input.id);
  revalidateGameCatalog();
  if (limitWrite.error && /bonus_enabled|bonus_min_deposit|bonus_max_amount|bonus_starts_at|bonus_ends_at|schema cache|column/i.test(limitWrite.error.message)) {
    return { ok: true, message: "Game saved. Bonus caps and dates need the Coins database update before they can be stored." };
  }
  if (limitWrite.error) return { ok: false, error: "Could not save the bonus limits." };
  return { ok: true, message: "Game saved." };
}

// ── Blog posts ───────────────────────────────────────────────────────────────

const blogSchema = z.object({
  slug: z.string().trim().regex(/^[a-z0-9-]+$/, "Lowercase, numbers, hyphens").min(3).max(80),
  title: z.string().trim().min(3).max(140),
  excerpt: z.string().trim().max(300).optional().default(""),
  // raised from 50000: rich content markdown (headings/tables/callouts/images) easily exceeds that
  content: z.string().trim().max(200000).optional().default(""),
  seo_title: z.string().trim().max(70).optional().default(""),
  seo_description: z.string().trim().max(200).optional().default(""),
  status: z.enum(["draft", "scheduled", "published", "archived"]),
  published_at: z.string().optional().default(""),
});

export async function upsertBlogPostAction(
  input: z.infer<typeof blogSchema> & { id?: string }
): Promise<AdminActionResult> {
  const auth = await authorize(PERMISSION);
  if ("error" in auth) return { ok: false, error: auth.error };

  const parsed = blogSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };

  const scheduledAt = parsed.data.status === "scheduled" ? parseNepalLocalToUtc(parsed.data.published_at) : null;
  if (parsed.data.status === "scheduled" && (!scheduledAt || scheduledAt.getTime() <= Date.now())) {
    return { ok: false, error: "Pick a future Nepal date and time to schedule this post." };
  }

  const { seo_title, seo_description, published_at: _publishedAt, ...rest } = parsed.data;
  const db = adminDb();
  const payload = {
    ...rest,
    seo_title: seo_title || null,
    seo_description: seo_description || null,
    author_id: auth.staff.userId,
    published_at:
      parsed.data.status === "scheduled"
        ? scheduledAt!.toISOString()
        : parsed.data.status === "published"
          ? new Date().toISOString()
          : null,
  };
  const result = input.id
    ? await db.from("blog_posts").update(payload).eq("id", input.id)
    : await db.from("blog_posts").insert(payload);
  if (result.error) {
    return {
      ok: false,
      error: /duplicate|unique/.test(result.error.message)
        ? "That slug is already in use."
        : "Could not save the post.",
    };
  }

  await writeAudit({
    actorId: auth.staff.userId,
    action: input.id ? "blog.update" : "blog.create",
    entityType: "blog_post",
    entityId: input.id ?? null,
    after: { slug: parsed.data.slug, status: parsed.data.status },
  });
  revalidateContent();
  revalidatePath("/community");
  return { ok: true, message: "Post saved." };
}

export async function fetchBlogPostForEditAction(
  id: string
): Promise<
  | {
      ok: true;
      post: {
        id: string;
        slug: string;
        title: string;
        excerpt: string | null;
        content: string;
        status: string;
        seo_title: string | null;
        seo_description: string | null;
        published_at: string | null;
      };
    }
  | { ok: false; error: string }
> {
  const auth = await authorize(PERMISSION);
  if ("error" in auth) return { ok: false, error: auth.error };

  const db = adminDb();
  const { data, error } = await db
    .from("blog_posts")
    .select("id, slug, title, excerpt, content, status, seo_title, seo_description, published_at")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return { ok: false, error: "Post not found." };
  return { ok: true, post: data };
}

const IMAGE_ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/avif"];
const IMAGE_MAX_BYTES = 8 * 1024 * 1024; // 8 MB — matches the cms-media bucket's own limit

export async function uploadBlogImageAction(
  formData: FormData
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const auth = await authorize(PERMISSION);
  if ("error" in auth) return { ok: false, error: auth.error };

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { ok: false, error: "No file provided." };
  if (file.size > IMAGE_MAX_BYTES) return { ok: false, error: "Image must be under 8 MB." };
  if (!IMAGE_ALLOWED_TYPES.includes(file.type)) {
    return { ok: false, error: "Only PNG, JPEG, WebP and AVIF images are accepted." };
  }

  const db = adminDb();
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `blog/${randomUUID()}.${ext}`;
  const bytes = await file.arrayBuffer();

  const { error: uploadError } = await db.storage
    .from("cms-media")
    .upload(path, Buffer.from(bytes), { contentType: file.type, upsert: false });
  if (uploadError) return { ok: false, error: "Failed to upload image." };

  const { data } = db.storage.from("cms-media").getPublicUrl(path);
  return { ok: true, url: data.publicUrl };
}
