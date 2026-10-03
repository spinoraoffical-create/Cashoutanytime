"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { ALL_50_US_STATES } from "@/lib/geo-all-50-states";

import {
  AdminActionResult,
  adminDb,
  authorize,
  writeAudit,
} from "@/lib/actions/admin/core";

const PERMISSION = "cms.manage";

function revalidateGeo(stateSlug?: string, citySlug?: string) {
  revalidatePath("/admin/geo");
  revalidatePath("/sitemap.xml");
  revalidatePath("/");
  if (stateSlug) revalidatePath(`/${stateSlug}`);
  if (stateSlug && citySlug) revalidatePath(`/${stateSlug}/${citySlug}`);
}

export async function bulkGenerateGeoPagesAction(): Promise<AdminActionResult> {
  const auth = await authorize(PERMISSION);
  if ("error" in auth) return { ok: false, error: auth.error };

  const admin = createAdminClient();
  const db = admin || adminDb();
  let createdCount = 0;

  for (const st of ALL_50_US_STATES) {
    let { data: existingState } = await db
      .from("geo_states")
      .select("id")
      .eq("slug", st.slug)
      .maybeSingle();

    let stateId = existingState?.id;

    if (!stateId) {
      const { data: newState } = await db
        .from("geo_states")
        .insert({
          name: st.name,
          slug: st.slug,
          abbr: st.abbr,
          hero_lede: st.lede,
          meta_description: st.lede,
          sort_order: createdCount,
          is_active: true,
        })
        .select("id")
        .single();

      if (newState) {
        stateId = newState.id;
        createdCount += 1;
      }
    }

    if (stateId) {
      for (const ct of st.cities) {
        const { data: existingCity } = await db
          .from("geo_cities")
          .select("id")
          .eq("state_id", stateId)
          .eq("slug", ct.slug)
          .maybeSingle();

        if (!existingCity) {
          await db.from("geo_cities").insert({
            state_id: stateId,
            slug: ct.slug,
            name: ct.name,
            description_snippet: ct.desc,
            sort_order: createdCount,
            is_active: true,
          });
          createdCount += 1;
        }
      }
    }
  }

  revalidatePath("/admin/geo");
  revalidatePath("/");
  revalidatePath("/sitemap.xml");

  await writeAudit({
    actorId: auth.staff.userId,
    action: "geo.bulk_generate",
    entityType: "geo_state",
    after: { createdCount },
  });

  return { ok: true, message: `Published ${createdCount} new geo pages to database.` };
}

export async function listGeoPagesAction(): Promise<{
  ok: boolean;
  states?: Array<{
    id: string;
    name: string;
    slug: string;
    abbr: string;
    is_active: boolean;
    cities: Array<{ id: string; name: string; slug: string; is_active: boolean }>;
  }>;
  error?: string;
}> {
  const auth = await authorize(PERMISSION);
  if ("error" in auth) return { ok: false, error: auth.error };

  const db = adminDb();
  const { data: states, error } = await db
    .from("geo_states")
    .select("id, name, slug, abbr, is_active, geo_cities(id, name, slug, is_active)")
    .order("sort_order");

  if (error) return { ok: false, error: error.message };

  return {
    ok: true,
    states: (states ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      abbr: s.abbr,
      is_active: s.is_active,
      cities: ((s as { geo_cities?: Array<{ id: string; name: string; slug: string; is_active: boolean }> }).geo_cities ?? []).map(
        (c) => ({ id: c.id, name: c.name, slug: c.slug, is_active: c.is_active })
      ),
    })),
  };
}

export async function deleteGeoPageAction(
  type: "state" | "city",
  id: string,
  stateSlug?: string
): Promise<AdminActionResult> {
  const auth = await authorize(PERMISSION);
  if ("error" in auth) return { ok: false, error: auth.error };

  const admin = createAdminClient();
  const db = admin || adminDb();

  if (type === "state") {
    await db.from("geo_states").delete().eq("id", id);
  } else {
    await db.from("geo_cities").delete().eq("id", id);
  }

  revalidateGeo(stateSlug);
  await writeAudit({
    actorId: auth.staff.userId,
    action: type === "state" ? "geo_state.delete" : "geo_city.delete",
    entityType: type === "state" ? "geo_state" : "geo_city",
    entityId: id,
  });
  return { ok: true, message: "Page deleted successfully." };
}

// ── States ───────────────────────────────────────────────────────────────────

const stateSchema = z.object({
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]+$/, "Lowercase, numbers, hyphens").min(2).max(40),
  name: z.string().trim().min(2).max(60),
  abbr: z.string().trim().toUpperCase().length(2),
  hero_lede: z.string().trim().max(600),
  meta_description: z.string().trim().max(300),
  hero_image_url: z.string().trim().max(1000).optional().default(""),
  sort_order: z.number().int().min(0).max(9999),
  is_active: z.boolean(),
});

export async function upsertGeoStateAction(
  input: z.infer<typeof stateSchema> & { id?: string }
): Promise<AdminActionResult> {
  const auth = await authorize(PERMISSION);
  if ("error" in auth) return { ok: false, error: auth.error };

  const parsed = stateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };

  const row = { ...parsed.data, hero_image_url: parsed.data.hero_image_url || null };

  const db = adminDb();
  const result = input.id
    ? await db.from("geo_states").update(row).eq("id", input.id)
    : await db.from("geo_states").insert(row);
  if (result.error) {
    return {
      ok: false,
      error: /duplicate|unique/.test(result.error.message)
        ? "That state slug is already in use."
        : "Could not save the state.",
    };
  }

  await writeAudit({
    actorId: auth.staff.userId,
    action: input.id ? "geo_state.update" : "geo_state.create",
    entityType: "geo_state",
    entityId: input.id ?? null,
    after: row,
  });
  revalidateGeo(parsed.data.slug);
  return { ok: true, message: "State saved." };
}

// ── Cities ───────────────────────────────────────────────────────────────────

const citySchema = z.object({
  state_id: z.string().uuid(),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]+$/, "Lowercase, numbers, hyphens").min(2).max(40),
  name: z.string().trim().min(2).max(60),
  description_snippet: z.string().trim().max(200),
  sort_order: z.number().int().min(0).max(9999),
  is_active: z.boolean(),
});

export async function upsertGeoCityAction(
  input: z.infer<typeof citySchema> & { id?: string; state_slug?: string }
): Promise<AdminActionResult> {
  const auth = await authorize(PERMISSION);
  if ("error" in auth) return { ok: false, error: auth.error };

  const parsed = citySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };

  const db = adminDb();
  const result = input.id
    ? await db.from("geo_cities").update(parsed.data).eq("id", input.id)
    : await db.from("geo_cities").insert(parsed.data);
  if (result.error) {
    return {
      ok: false,
      error: /duplicate|unique/.test(result.error.message)
        ? "That city slug already exists for this state."
        : "Could not save the city.",
    };
  }

  await writeAudit({
    actorId: auth.staff.userId,
    action: input.id ? "geo_city.update" : "geo_city.create",
    entityType: "geo_city",
    entityId: input.id ?? null,
    after: parsed.data,
  });
  revalidateGeo(input.state_slug, parsed.data.slug);
  return { ok: true, message: "City saved." };
}
