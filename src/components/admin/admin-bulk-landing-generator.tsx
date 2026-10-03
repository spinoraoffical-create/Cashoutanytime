"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { GlassCard } from "@/components/shared/glass-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Globe, Sparkles, MapPin, ExternalLink, CheckCircle2, Trash2 } from "lucide-react";
import {
  bulkGenerateGeoPagesAction,
  deleteGeoPageAction,
  listGeoPagesAction,
} from "@/lib/actions/admin/geo";

type GeoStateRow = {
  id: string;
  name: string;
  slug: string;
  abbr: string;
  is_active: boolean;
  cities: Array<{ id: string; name: string; slug: string; is_active: boolean }>;
};

export function AdminBulkLandingGenerator() {
  const [generating, setGenerating] = useState(false);
  const [statesList, setStatesList] = useState<GeoStateRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const res = await listGeoPagesAction();
    if (res.ok && res.states) {
      setStatesList(res.states);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleBulkGenerate() {
    setGenerating(true);
    const res = await bulkGenerateGeoPagesAction();
    setGenerating(false);

    if (res.ok) {
      toast.success(res.message || "Geo pages published.");
      await refresh();
    } else {
      toast.error(res.error || "Bulk generate failed.");
    }
  }

  async function handleDeleteCity(stateSlug: string, cityId: string, cityName: string) {
    const res = await deleteGeoPageAction("city", cityId, stateSlug);
    if (res.ok) {
      toast.success(`Deleted ${cityName}.`);
      await refresh();
    } else {
      toast.error(res.error || "Delete failed.");
    }
  }

  async function handleDeleteState(stateId: string, stateSlug: string, stateName: string) {
    const res = await deleteGeoPageAction("state", stateId, stateSlug);
    if (res.ok) {
      toast.success(`Deleted ${stateName} and its cities.`);
      await refresh();
    } else {
      toast.error(res.error || "Delete failed.");
    }
  }

  const totalCities = statesList.reduce((acc, s) => acc + s.cities.length, 0);

  return (
    <GlassCard className="p-6 border-amber-500/40 bg-gradient-to-r from-amber-950/30 via-zinc-900 to-black space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border/50 pb-4 gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30 shadow-lg">
            <Globe className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-foreground">Bulk US States SEO Generator</h2>
              <Badge className="bg-emerald-500/20 text-emerald-400 font-mono text-[9px]">DB-BACKED</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Publish all 50 states + cities to Supabase. Homepage and sitemap use live DB data.
            </p>
          </div>
        </div>

        <Button
          onClick={() => void handleBulkGenerate()}
          disabled={generating}
          className="bg-gradient-to-r from-amber-500 to-amber-400 text-black font-extrabold py-6 px-8 rounded-2xl gap-2 shrink-0"
        >
          <Sparkles className="h-4 w-4" />
          {generating ? "Publishing..." : "Generate All 50 States"}
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3 rounded-xl border border-border/60 bg-background/40">
          <span className="text-muted-foreground block text-[10px] uppercase font-bold">Published States</span>
          <span className="text-lg font-extrabold text-amber-400">{loaded ? statesList.length : "..."}</span>
        </div>
        <div className="p-3 rounded-xl border border-border/60 bg-background/40">
          <span className="text-muted-foreground block text-[10px] uppercase font-bold">Cities in DB</span>
          <span className="text-lg font-extrabold text-amber-400">{loaded ? totalCities : "..."}</span>
        </div>
        <div className="p-3 rounded-xl border border-border/60 bg-background/40">
          <span className="text-muted-foreground block text-[10px] uppercase font-bold">Data source</span>
          <span className="text-lg font-extrabold text-emerald-400">Supabase</span>
        </div>
        <div className="p-3 rounded-xl border border-border/60 bg-background/40">
          <span className="text-muted-foreground block text-[10px] uppercase font-bold">Deletes</span>
          <span className="text-lg font-extrabold text-emerald-400">Real UUIDs</span>
        </div>
      </div>

      {!loaded && <p className="text-sm text-muted-foreground">Loading geo pages from database...</p>}

      {loaded && statesList.length === 0 && (
        <p className="text-sm text-amber-200/80">
          No geo pages in database yet. Click Generate to publish all 50 states.
        </p>
      )}

      {statesList.length > 0 && (
        <div className="pt-3 border-t border-border/50 space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Live pages (real DB IDs)
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs max-h-[600px] overflow-y-auto pr-1">
            {statesList.map((state) => (
              <div key={state.id} className="p-3 rounded-2xl border border-border/60 bg-zinc-900/80 space-y-2.5">
                <div className="flex items-center justify-between border-b border-border/40 pb-2">
                  <span className="font-bold text-foreground text-sm flex items-center gap-1.5">
                    {state.name} ({state.abbr})
                    {!state.is_active && (
                      <Badge variant="outline" className="bg-rose-500/10 text-rose-400 border-rose-500/30 text-[9px] px-1 py-0 h-4 leading-none">
                        Inactive
                      </Badge>
                    )}
                  </span>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/${state.slug}`}
                      target="_blank"
                      className="text-[10px] font-bold text-amber-400 hover:underline inline-flex items-center gap-1"
                    >
                      View <ExternalLink className="h-3 w-3" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => void handleDeleteState(state.id, state.slug, state.name)}
                      className="text-muted-foreground hover:text-rose-400 p-1"
                      title={`Delete ${state.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  {state.cities.map((city) => (
                    <div
                      key={city.id}
                      className="flex items-center justify-between p-1.5 rounded-xl bg-background/60 border border-border/40 text-[11px]"
                    >
                      <span className="font-medium text-zinc-300 flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-amber-400 shrink-0" /> {city.name}
                        {!city.is_active && (
                          <span className="text-[9px] font-bold text-rose-400 bg-rose-500/10 px-1 rounded border border-rose-500/20 ml-1">
                            Inactive
                          </span>
                        )}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/${state.slug}/${city.slug}`}
                          target="_blank"
                          className="text-[9px] text-amber-400 hover:underline inline-flex items-center gap-0.5"
                        >
                          View <ExternalLink className="h-2.5 w-2.5" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => void handleDeleteCity(state.slug, city.id, city.name)}
                          className="text-muted-foreground hover:text-rose-400 p-0.5"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </GlassCard>
  );
}
