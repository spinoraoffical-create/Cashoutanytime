import type { Metadata } from "next";

export const dynamic = "force-dynamic";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminBulkLandingGenerator } from "@/components/admin/admin-bulk-landing-generator";
import { ConfirmActionButton } from "@/components/admin/confirm-action-button";
import {
  EntityEditDialog,
  type FieldValue,
} from "@/components/admin/entity-edit-dialog";
import { AdminEmptyState } from "@/components/admin/ui/admin-empty-state";
import { AdminStatusBadge } from "@/components/admin/ui/admin-status-badge";
import { deleteCmsEntityAction } from "@/lib/actions/admin/cms";
import { upsertGeoCityAction, upsertGeoStateAction } from "@/lib/actions/admin/geo";
import { adminDb } from "@/lib/actions/admin/core";
import { requirePermission } from "@/lib/data/admin";

export const metadata: Metadata = { title: "City pages" };

export default async function AdminGeoPage() {
  await requirePermission("cms.manage");
  const db = adminDb();

  const [{ data: statesData }, { data: citiesData }] = await Promise.all([
    db
      .from("geo_states")
      .select("id, slug, name, abbr, hero_lede, meta_description, hero_image_url, sort_order, is_active")
      .order("sort_order"),
    db
      .from("geo_cities")
      .select("id, state_id, slug, name, description_snippet, sort_order, is_active")
      .order("sort_order"),
  ]);

  const states = statesData ?? [];
  const citiesByState = new Map<string, typeof citiesData>();
  for (const city of citiesData ?? []) {
    const list = citiesByState.get(city.state_id) ?? [];
    list.push(city);
    citiesByState.set(city.state_id, list);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <AdminPageHeader
          title="City pages"
          description="States and cities already stored for the public landing pages. A page is saved only when you press save. The generator below still publishes only when you press its button."
        />
        <EntityEditDialog
          title="Add state"
          triggerLabel="Add state"
          fields={[
            { name: "name", label: "Name", type: "text", defaultValue: "" },
            { name: "slug", label: "URL slug", type: "text", defaultValue: "", hint: "Sets the page URL: /slug. Lowercase, hyphens only." },
            { name: "abbr", label: "Abbreviation (2 letters)", type: "text", defaultValue: "" },
            { name: "hero_lede", label: "Hero copy", type: "textarea", defaultValue: "" },
            { name: "meta_description", label: "Meta description", type: "textarea", defaultValue: "" },
            { name: "hero_image_url", label: "Hero background image URL", type: "text", defaultValue: "", hint: "Optional. Shown behind the hero text on the state/city pages." },
            { name: "sort_order", label: "Sort order", type: "number", defaultValue: states.length },
            { name: "is_active", label: "Active (visible to players)", type: "switch", defaultValue: true },
          ]}
          action={async (v: Record<string, FieldValue>) => {
            "use server";
            return upsertGeoStateAction({
              name: String(v.name),
              slug: String(v.slug),
              abbr: String(v.abbr),
              hero_lede: String(v.hero_lede),
              meta_description: String(v.meta_description),
              hero_image_url: String(v.hero_image_url ?? ""),
              sort_order: Number(v.sort_order),
              is_active: Boolean(v.is_active),
            });
          }}
        />
      </div>

      {/* 1-Click Bulk SEO Landing Page Generator */}
      <AdminBulkLandingGenerator />

      {states.length === 0 ? (
        <AdminEmptyState title="No states yet" body="Add a state when you are ready. Nothing is published until you save it." />
      ) : (
      <div className="space-y-4">
        {states.map((state) => {
          const cities = citiesByState.get(state.id) ?? [];
          return (
            <section key={state.id} className="rounded-2xl border border-[#7c3aed]/25 bg-gradient-to-br from-[#141432] to-[#0d1428] p-4 shadow-[0_16px_40px_rgba(49,46,129,0.2)]">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-white">{state.name}</p>
                  <span className="inline-flex rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-[#d5def2]">{state.abbr}</span>
                  {!state.is_active ? <AdminStatusBadge status="inactive" /> : <AdminStatusBadge status="active" />}
                </div>
                <div className="flex items-center gap-2">
                  <EntityEditDialog
                    title={`Edit — ${state.name}`}
                    triggerLabel="Edit state"
                    fields={[
                      { name: "name", label: "Name", type: "text", defaultValue: state.name },
                      { name: "slug", label: "URL slug", type: "text", defaultValue: state.slug, hint: `Sets the page URL: /${state.slug}` },
                      { name: "abbr", label: "Abbreviation (2 letters)", type: "text", defaultValue: state.abbr },
                      { name: "hero_lede", label: "Hero copy", type: "textarea", defaultValue: state.hero_lede },
                      { name: "meta_description", label: "Meta description", type: "textarea", defaultValue: state.meta_description },
                      { name: "hero_image_url", label: "Hero background image URL", type: "text", defaultValue: state.hero_image_url ?? "", hint: "Optional. Shown behind the hero text on the state/city pages." },
                      { name: "sort_order", label: "Sort order", type: "number", defaultValue: state.sort_order },
                      { name: "is_active", label: "Active (visible to players)", type: "switch", defaultValue: state.is_active },
                    ]}
                    action={async (v: Record<string, FieldValue>) => {
                      "use server";
                      return upsertGeoStateAction({
                        id: state.id,
                        name: String(v.name),
                        slug: String(v.slug),
                        abbr: String(v.abbr),
                        hero_lede: String(v.hero_lede),
                        meta_description: String(v.meta_description),
                        hero_image_url: String(v.hero_image_url ?? ""),
                        sort_order: Number(v.sort_order),
                        is_active: Boolean(v.is_active),
                      });
                    }}
                  />
                  <ConfirmActionButton
                    title={`Delete ${state.name}?`}
                    description="This also deletes every city under this state. The page will 404 immediately."
                    confirmLabel="Delete"
                    triggerLabel="Delete"
                    variant="outline"
                    action={deleteCmsEntityAction.bind(null, "geo_states", state.id)}
                  />
                </div>
              </div>

              <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
                {cities.map((city) => (
                  <div key={city.id} className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="text-white">{city.name}</span>
                      {!city.is_active ? <AdminStatusBadge status="inactive" /> : null}
                      <span className="text-xs text-[#9fb0d0]">{city.description_snippet}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <EntityEditDialog
                        title={`Edit — ${city.name}`}
                        fields={[
                          { name: "name", label: "Name", type: "text", defaultValue: city.name },
                          { name: "slug", label: "URL slug", type: "text", defaultValue: city.slug, hint: `Sets the page URL: /${state.slug}/${city.slug}` },
                          { name: "description_snippet", label: "Description snippet", type: "textarea", defaultValue: city.description_snippet },
                          { name: "sort_order", label: "Sort order", type: "number", defaultValue: city.sort_order },
                          { name: "is_active", label: "Active (visible to players)", type: "switch", defaultValue: city.is_active },
                        ]}
                        action={async (v: Record<string, FieldValue>) => {
                          "use server";
                          return upsertGeoCityAction({
                            id: city.id,
                            state_id: state.id,
                            state_slug: state.slug,
                            name: String(v.name),
                            slug: String(v.slug),
                            description_snippet: String(v.description_snippet),
                            sort_order: Number(v.sort_order),
                            is_active: Boolean(v.is_active),
                          });
                        }}
                      />
                      <ConfirmActionButton
                        title={`Delete ${city.name}?`}
                        description="The city page will 404 immediately."
                        confirmLabel="Delete"
                        action={deleteCmsEntityAction.bind(null, "geo_cities", city.id)}
                      />
                    </div>
                  </div>
                ))}

                <EntityEditDialog
                  title={`Add city to ${state.name}`}
                  triggerLabel={`Add city to ${state.name}`}
                  fields={[
                    { name: "name", label: "Name", type: "text", defaultValue: "" },
                    { name: "slug", label: "URL slug", type: "text", defaultValue: "", hint: `Sets the page URL: /${state.slug}/slug` },
                    { name: "description_snippet", label: "Description snippet", type: "textarea", defaultValue: "" },
                    { name: "sort_order", label: "Sort order", type: "number", defaultValue: cities.length },
                    { name: "is_active", label: "Active (visible to players)", type: "switch", defaultValue: true },
                  ]}
                  action={async (v: Record<string, FieldValue>) => {
                    "use server";
                    return upsertGeoCityAction({
                      state_id: state.id,
                      state_slug: state.slug,
                      name: String(v.name),
                      slug: String(v.slug),
                      description_snippet: String(v.description_snippet),
                      sort_order: Number(v.sort_order),
                      is_active: Boolean(v.is_active),
                    });
                  }}
                />
              </div>
            </section>
          );
        })}
      </div>
      )}
    </div>
  );
}
