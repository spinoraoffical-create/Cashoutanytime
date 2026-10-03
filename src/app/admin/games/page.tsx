import type { Metadata } from "next";
import Image from "next/image";
import { Check, Minus, Webhook } from "lucide-react";
import { revalidatePath } from "next/cache";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import {
  EntityEditDialog,
  type FieldValue,
} from "@/components/admin/entity-edit-dialog";
import { GlassCard } from "@/components/shared/glass-card";
import { Badge } from "@/components/ui/badge";
import { adminDb, authorize } from "@/lib/actions/admin/core";
import { upsertGameAction } from "@/lib/actions/admin/cms";
import { requirePermission } from "@/lib/data/admin";

async function saveGameServerConfig(
  gameId: string,
  values: Record<string, FieldValue>
): Promise<{ ok: true } | { ok: false; error: string }> {
  "use server";
  const auth = await authorize("cms.manage");
  if ("error" in auth) return { ok: false, error: auth.error };

  const db = adminDb();
  const { error } = await db.from("game_server_configs").upsert(
    {
      game_id:        gameId,
      webhook_secret: values.webhook_secret ? String(values.webhook_secret) : null,
      is_enabled:     Boolean(values.is_enabled),
      api_base_url:   values.api_base_url   ? String(values.api_base_url)   : null,
      api_username:   values.api_username   ? String(values.api_username)   : null,
      api_password:   values.api_password   ? String(values.api_password)   : null,
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

export default async function AdminGamesPage() {
  await requirePermission("cms.manage");
  const db = adminDb();

  const [{ data: gamesData }, { data: configsData }] = await Promise.all([
    db
      .from("games")
      .select(
        "id, slug, name, description, image_url, badge_text, is_featured, is_active, play_url, download_url"
      )
      .order("name"),
    db
      .from("game_server_configs")
      .select("game_id, webhook_secret, is_enabled, api_base_url, api_username, api_password, notes"),
  ]);

  const games = gamesData ?? [];
  const configsByGameId = new Map(
    (configsData ?? []).map((c) => [c.game_id, c])
  );

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  return (
    <div className="mx-auto max-w-6xl">
      <AdminPageHeader
        title="Games"
        description="Set each game's thumbnail image, play URL and download URL. Upload images to Supabase Storage → cms-media bucket, then paste the public URL here."
      />

      {/* Image upload guide */}
      <GlassCard className="mb-6 p-4">
        <p className="text-sm font-medium text-ws-green-deep dark:text-ws-green">How to add game images</p>
        <ol className="mt-2 space-y-1 text-sm text-muted-foreground">
          <li>1. Go to <strong className="text-foreground">Supabase dashboard → Storage → cms-media</strong></li>
          <li>2. Click <strong className="text-foreground">Upload file</strong> and upload your game image (PNG/JPG/WebP, max 8 MB)</li>
          <li>3. Click the uploaded file → <strong className="text-foreground">Copy URL</strong></li>
          <li>4. Click <strong className="text-foreground">Edit</strong> on the game below and paste the URL into Image URL</li>
        </ol>
      </GlassCard>

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
            <GlassCard key={game.id} className="flex flex-col overflow-hidden p-0">
              {/* Thumbnail */}
              <div className="relative aspect-video w-full shrink-0 bg-foreground/5">
                {game.image_url ? (
                  <Image
                    src={game.image_url}
                    alt={game.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
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
                  <Badge className="absolute top-2 right-2 bg-emerald-500 text-foreground text-xs uppercase">
                    {game.badge_text}
                  </Badge>
                )}
              </div>

              {/* Info */}
              <div className="flex flex-1 flex-col gap-3 p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{game.name}</p>
                    {!game.is_active && (
                      <Badge className="bg-foreground/8 text-muted-foreground text-xs">
                        Inactive
                      </Badge>
                    )}
                    {game.is_featured && (
                      <Badge className="bg-ws-green/15 text-ws-green-deep dark:text-ws-green text-xs">
                        Featured
                      </Badge>
                    )}
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
                </div>

                {/* Webhook config */}
                <div className="rounded-lg border border-foreground/8 bg-foreground/4 p-3 text-xs">
                  <div className="flex items-center gap-1.5 font-medium text-muted-foreground">
                    <Webhook className="size-3.5" aria-hidden />
                    Webhook
                    {cfg?.is_enabled && (
                      <span className="ml-auto text-ws-emerald">Active</span>
                    )}
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
                          defaultValue: cfg?.webhook_secret ?? "",
                          hint: "Shared secret — paste this into the game portal's webhook settings",
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
                          defaultValue: cfg?.api_username ?? "",
                          hint: "Your agent.gamevault999.com login username — enables auto account creation & recharge",
                        },
                        {
                          name: "api_password",
                          label: "Agent Portal Password",
                          type: "text",
                          defaultValue: cfg?.api_password ?? "",
                          hint: "Your agent portal password — stored server-side only, never visible to players",
                        },
                        {
                          name: "api_base_url",
                          label: "API Base URL (override)",
                          type: "text",
                          defaultValue: cfg?.api_base_url ?? "",
                          hint: "Leave blank to use the default agent.gamevault999.com endpoint",
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
                      });
                    }}
                  />
                </div>
              </div>
            </GlassCard>
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
