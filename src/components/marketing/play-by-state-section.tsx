import Link from "next/link";
import { MapPin, Globe, CheckCircle2 } from "lucide-react";
import { getGeoStates } from "@/lib/data/marketing";
import { ALL_50_US_STATES } from "@/lib/geo-all-50-states";

export async function PlayByStateSection() {
  const dbStates = await getGeoStates();
  const useDb = dbStates.length >= 7;

  const states = useDb
    ? dbStates.map((s) => ({
        name: s.name,
        slug: s.slug,
        abbr: s.abbr,
        cities: s.cities.map((c) => ({ name: c.name, slug: c.slug })),
      }))
    : ALL_50_US_STATES.map((s) => ({
        name: s.name,
        slug: s.slug,
        abbr: s.abbr,
        cities: s.cities.map((c) => ({ name: c.name, slug: c.slug })),
      }));

  const totalCities = states.reduce((acc, s) => acc + s.cities.length, 0);

  return (
    <section aria-labelledby="play-by-state-heading" className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      <div className="rounded-3xl border border-amber-500/30 bg-gradient-to-r from-amber-950/20 via-zinc-900/90 to-black p-6 sm:p-8 space-y-6 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border/50 pb-4 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-amber-400" aria-hidden />
              <h2 id="play-by-state-heading" className="text-xl font-extrabold text-foreground">
                {useDb ? "Live" : "Planned"} US State & City Coverage
              </h2>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {useDb
                ? "Active geo landing pages from your CMS — indexed in sitemap."
                : "Run bulk generate in Admin → Geo to publish all pages to the database."}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold text-xs flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" /> {states.length} States
            </span>
            <span className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-xs flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> {totalCities}+ Cities
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {states.map((state) => (
            <div
              key={state.slug}
              className="p-3.5 rounded-2xl border border-border/50 bg-zinc-900/60 space-y-2 hover:border-amber-500/40 transition-colors"
            >
              <div className="flex items-center justify-between">
                <Link
                  href={`/${state.slug}`}
                  className="text-sm font-extrabold text-foreground hover:text-amber-400 transition-colors"
                >
                  {state.name} ({state.abbr})
                </Link>
                <span className="text-[10px] font-bold text-amber-400/80 bg-amber-500/10 px-1.5 py-0.5 rounded">
                  {state.cities.length} Cities
                </span>
              </div>

              <div className="flex flex-wrap gap-1">
                {state.cities.map((city) => (
                  <Link
                    key={city.slug}
                    href={`/${state.slug}/${city.slug}`}
                    className="text-[10px] text-muted-foreground hover:text-amber-300 hover:bg-amber-500/10 px-2 py-0.5 rounded-lg border border-border/40 transition-colors"
                  >
                    {city.name}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
