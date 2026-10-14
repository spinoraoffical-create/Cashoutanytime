import type { Metadata } from "next";
import { Check, Minus, Webhook } from "lucide-react";
import { revalidatePath } from "next/cache";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import {
  EntityEditDialog,
  type FieldValue,
} from "@/components/admin/entity-edit-dialog";
import { AdminSectionCard } from "@/components/admin/ui/admin-section-card";
import { AdminStatusBadge } from "@/components/admin/ui/admin-status-badge";
import { adminDb, authorize } from "@/lib/actions/admin/core";
import { upsertGameAction } from "@/lib/actions/admin/cms";
import { requirePermission } from "@/lib/data/admin";
import { GAMES, canonicalGameSlug } from "@/lib/games";

async function saveGameServerConfig(
  gameId: string,
  values: Record<string, FieldValue>
): Promise<{ ok: true } | { ok: false; error: string }> {
  "use server";
  const auth = await authorize("cms.manage");
  if ("error" in auth) return { ok: false, error: auth.error };

  const db = adminDb();
  const { data: current } = await db
    .from("game_server_configs")
    .select("webhook_secret, api_username, api_password")
    .eq("game_id", gameId)
    .maybeSingle();
  const keepSecret = (next: FieldValue | undefined, previous: string | null | undefined) => {
    const text = next == null ? "" : String(next).trim();
    return text ? text : previous ?? null;
  };
  const { error } = await db.from("game_server_configs").upsert(
    {
      game_id:        gameId,
      webhook_secret: keepSecret(values.webhook_secret, current?.webhook_secret),
      is_enabled:     Boolean(values.is_enabled),
      api_base_url:   values.api_base_url ? String(values.api_base_url) : null,
      api_username:   keepSecret(values.api_username, current?.api_username),
      api_password:   keepSecret(values.api_password, current?.api_password),
      notes:          values.notes          ? String(values.notes)          : null,
    },
    { onConflict: "game_id" }
  );

  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/games");
  return { ok: true };
}

export const metadata: Metadata = { title: "Games" };

const INITIALS_BG = [
  "from-emerald-500/30 to-emerald-500/10",
  "from-ws-cyan/30 to-ws-cyan/10",
  "from-ws-purple/30 to-ws-purple/10",
  "from-ws-emerald/30 to-ws-emerald/10",
];

async function ensureCatalogGames(db: ReturnType<typeof adminDb>) {
  const { data: existing } = await db.from("games").select("slug, category_id");
  const have = new Set((existing ?? []).map((row) => canonicalGameSlug(String(row.slug))));
  const missing = GAMES.filter((game) => !have.has(canonicalGameSlug(game.slug)));
  if (!missing.length) return;

  const categoryFrom = (slug: string) =>
    existing?.find((row) => row.slug === slug)?.category_id ?? null;
  const fishing = categoryFrom("juwa") ?? categoryFrom("fire-kirin");
  const slots = categoryFrom("game-vault") ?? categoryFrom("cash-frenzy") ?? categoryFrom("cashmachine");
  const tables = categoryFrom("neon-poker-xl") ?? categoryFrom("high-stakes") ?? slots;
  const categoryId = (category: string) =>
    category.toLowerCase().includes("fish") ? fishing : category.toLowerCase().includes("table") ? tables : slots;

  const rows = missing.flatMap((game) => {
    const category_id = categoryId(game.category);
    if (!category_id) return [];
    return [{
      slug: game.slug,
      name: game.name,
      description: game.bio,
      image_url: game.image,
      download_url: game.downloadUrl.startsWith("http") ? game.downloadUrl : null,
      is_featured: false,
      is_active: false,
      popularity: Math.min(100, Math.round(game.players / 100)),
      category_id,
    }];
  });
  if (rows.length) await db.from("games").insert(rows);
}

export default async function AdminGamesPage() {
  await requirePermission("cms.manage");
  const db = adminDb();
  await ensureCatalogGames(db);

  const baseColumns =
    "id, slug, name, description, image_url, badge_text, is_featured, is_active, play_url, download_url";
  const bonusColumns =
    ", is_live, first_deposit_bonus_percent, reload_bonus_percent, bonus_text";
  const [gamesResult, configsResult] = await Promise.all([
    db.from("games").select(baseColumns + bonusColumns).order("name"),
    db
      .from("game_server_configs")
      .select("game_id, webhook_secret, is_enabled, api_base_url, api_username, api_password, notes"),
  ]);
  const gamesData = gamesResult.error
    ? (await db.from("games").select(baseColumns).order("name")).data
    : gamesResult.data;

  const games = (gamesData ?? []) as Array<{
    id: string;
    slug: string;
    name: string;
    description: string | null;
    image_url: string | null;
    badge_text: string | null;
    is_featured: boolean;
    is_active: boolean;
    play_url: string | null;
    download_url: string | null;
    is_live?: boolean;
    first_deposit_bonus_percent?: number;
    reload_bonus_percent?: number;
    bonus_text?: string | null;
  }>;
  const configsData = configsResult.data;
  const configsByGameId = new Map(
    (configsData ?? []).map((c) => [c.game_id, c])
  );

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  return (
    <div className="mx-auto max-w-6xl">
      <AdminPageHeader
        title="Games"
        description="Turn a game on, edit its public name and links, and see whether a provider connection is saved. This page does not show saved passwords or webhook secrets."
      />

      <AdminSectionCard className="mb-6" title="How to add game images" description="Images stay in the existing cms-media storage bucket.">
        <ol className="space-y-1 text-sm text-[#9fb0d0]">
          <li>1. Open Supabase Storage, then the cms-media bucket.</li>
          <li>2. Upload the game image. PNG, JPG, and WebP are accepted, up to 8 MB.</li>
          <li>3. Copy the public URL from the uploaded file.</li>
          <li>4. Choose Edit game below and paste that URL into Image URL.</li>
        </ol>
      </AdminSectionCard>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {games.map((game, i) => {
          const initials = game.name
            .split(" ")
            .map((w: string) => w[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();
          const bg = INITIALS_BG[i % INITIALS_BG.length];
          const cfg = configsByGameId.get(game.id);
          const webhookUrl = `${siteUrl}/api/webhooks/game/${game.slug}`;

          return (
            <article key={game.id} className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#10182e]/80">
              {/* Thumbnail */}
              <div className="relative aspect-video w-full shrink-0 bg-foreground/5">
                {game.image_url ? (
                  <img src={game.image_url} alt={game.name} className="h-full w-full object-cover" />
                ) : (
                  <div
                    className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${bg}`}
                  >
                    <span className="text-3xl font-bold text-foreground/60">
                      {initials}
                    </span>
                  </div>
                )}
                {game.badge_text && (
                  <span className="absolute top-2 right-2">
                    <AdminStatusBadge status={game.badge_text} />
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="flex flex-1 flex-col gap-3 p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-white">{game.name}</p>
                    <AdminStatusBadge status={game.is_active ? "Active" : "Inactive"} />
                    {game.is_featured ? <AdminStatusBadge status="Featured" /> : null}
                    <AdminStatusBadge status={game.is_live ? "Live" : "Not live"} />
                  </div>
                  {game.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {game.description}
                    </p>
                  )}
                </div>

                {/* URL status */}
                <div className="space-y-1 text-xs">
                  <UrlStatus label="Play URL" value={game.play_url} />
                  <UrlStatus label="Download URL" value={game.download_url} />
                  <UrlStatus label="Image URL" value={game.image_url} />
                  <p className="text-[#d5def2]">
                    First deposit {Number(game.first_deposit_bonus_percent ?? 50)}% · Reload {Number(game.reload_bonus_percent ?? 10)}%
                  </p>
                  <p className="text-[#9fb0d0]">
                    Provider connection {cfg?.is_enabled && (cfg.api_username || cfg.api_password) ? "saved" : "not saved"}
                  </p>
                </div>

                {/* Webhook config */}
                <div className="rounded-lg border border-white/10 bg-[#0b1224] p-3 text-xs">
                  <div className="flex items-center gap-1.5 font-medium text-[#9fb0d0]">
                    <Webhook className="size-3.5" aria-hidden />
                    Webhook
                    {cfg?.is_enabled ? <span className="ml-auto text-emerald-200">On</span> : <span className="ml-auto">Off</span>}
                  </div>
                  <p className="mt-1.5 break-all font-mono text-ws-text-faint">
                    {webhookUrl}
                  </p>
                  <div className="mt-2">
                    <EntityEditDialog
                      title={`Webhook — ${game.name}`}
                      triggerLabel="Configure webhook"
                      fields={[
                        {
                          name: "webhook_secret",
                          label: "Webhook Secret",
                          type: "text",
                          defaultValue: "",
                          hint: "Leave blank to keep the saved secret. This page does not show the saved value.",
                        },
                        {
                          name: "is_enabled",
                          label: "Enable webhook",
                          type: "switch",
                          defaultValue: cfg?.is_enabled ?? false,
                        },
                        {
                          name: "api_username",
                          label: "Agent Portal Username",
                          type: "text",
                          defaultValue: "",
                          hint: "Leave blank to keep the saved username. This page does not show the saved value.",
                        },
                        {
                          name: "api_password",
                          label: "Agent Portal Password",
                          type: "text",
                          defaultValue: "",
                          hint: "Leave blank to keep the saved password. This page does not show the saved value.",
                        },
                        {
                          name: "api_base_url",
                          label: "API Base URL (override)",
                          type: "text",
                          defaultValue: cfg?.api_base_url ?? "",
                          hint: "Leave blank to use the provider default.",
                        },
                        {
                          name: "notes",
                          label: "Notes",
                          type: "textarea",
                          defaultValue: cfg?.notes ?? "",
                        },
                      ]}
                      action={async (v: Record<string, FieldValue>) => {
                        "use server";
                        return saveGameServerConfig(game.id, v);
                      }}
                    />
                  </div>
                </div>

                {/* Edit */}
                <div className="mt-auto">
                  <EntityEditDialog
                    title={`Edit — ${game.name}`}
                    triggerLabel="Edit game"
                    fields={[
                      {
                        name: "name",
                        label: "Name",
                        type: "text",
                        defaultValue: game.name,
                      },
                      {
                        name: "slug",
                        label: "URL slug",
                        type: "text",
                        defaultValue: game.slug,
                        hint: `Sets the page URL: /games/${game.slug}. Lowercase, hyphens only. Changing it also changes the webhook URL.`,
                      },
                      {
                        name: "description",
                        label: "Description",
                        type: "textarea",
                        defaultValue: game.description ?? "",
                      },
                      {
                        name: "image_url",
                        label: "Image URL (paste from Supabase Storage → cms-media)",
                        type: "text",
                        defaultValue: game.image_url ?? "",
                        hint: "Public URL from the cms-media Storage bucket",
                      },
                      {
                        name: "play_url",
                        label: "Play Online URL",
                        type: "text",
                        defaultValue: game.play_url ?? "",
                        hint: "External link to play the game online",
                      },
                      {
                        name: "download_url",
                        label: "Download App URL",
                        type: "text",
                        defaultValue: game.download_url ?? "",
                        hint: "Link to download the mobile app",
                      },
                      {
                        name: "badge_text",
                        label: "Badge (HOT / NEW / EVENT — leave blank for none)",
                        type: "text",
                        defaultValue: game.badge_text ?? "",
                      },
                      {
                        name: "is_active",
                        label: "Active (visible to players)",
                        type: "switch",
                        defaultValue: game.is_active,
                      },
                      {
                        name: "is_featured",
                        label: "Featured (shown first on homepage)",
                        type: "switch",
                        defaultValue: game.is_featured,
                      },
                      {
                        name: "is_live",
                        label: "Live",
                        type: "switch",
                        defaultValue: Boolean(game.is_live),
                      },
                      {
                        name: "first_deposit_bonus_percent",
                        label: "First deposit bonus %",
                        type: "number",
                        defaultValue: Number(game.first_deposit_bonus_percent ?? 50),
                        min: 0,
                        step: 1,
                      },
                      {
                        name: "reload_bonus_percent",
                        label: "Reload bonus %",
                        type: "number",
                        defaultValue: Number(game.reload_bonus_percent ?? 10),
                        min: 0,
                        step: 1,
                      },
                      {
                        name: "bonus_text",
                        label: "Bonus text shown to players",
                        type: "text",
                        defaultValue: game.bonus_text ?? "",
                      },
                    ]}
                    action={async (v: Record<string, FieldValue>) => {
                      "use server";
                      return upsertGameAction({
                        id: game.id,
                        name: String(v.name),
                        slug: v.slug ? String(v.slug) : undefined,
                        description: String(v.description),
                        image_url: String(v.image_url),
                        play_url: String(v.play_url),
                        download_url: String(v.download_url),
                        badge_text: String(v.badge_text),
                        is_active: Boolean(v.is_active),
                        is_featured: Boolean(v.is_featured),
                        is_live: Boolean(v.is_live),
                        first_deposit_bonus_percent: Number(v.first_deposit_bonus_percent ?? 50),
                        reload_bonus_percent: Number(v.reload_bonus_percent ?? 10),
                        bonus_text: String(v.bonus_text ?? ""),
                      });
                    }}
                  />
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function UrlStatus({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      {value ? (
        <Check className="size-3 shrink-0 text-ws-emerald" aria-hidden />
      ) : (
        <Minus className="size-3 shrink-0 text-ws-text-faint" aria-hidden />
      )}
      <span className={value ? "text-foreground" : ""}>{label}</span>
      {value && (
        <span className="ml-auto max-w-[120px] truncate text-ws-text-faint">
          {value.replace(/^https?:\/\//, "")}
        </span>
      )}
    </div>
  );
}
