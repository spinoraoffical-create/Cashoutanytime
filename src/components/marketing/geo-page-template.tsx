import Link from "next/link";
import { ChevronRight, MapPin } from "lucide-react";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { MarketingGameGrid } from "@/components/marketing/game-grid";
import { GlassCard } from "@/components/shared/glass-card";
import { Button } from "@/components/ui/button";
import type { CityData, StateData } from "@/lib/geo-data";

interface GeoPageTemplateProps {
  state: StateData;
  city?: CityData;
}

function GeoFaqs({
  stateName,
  stateAbbr,
  cityName,
}: {
  stateName: string;
  stateAbbr: string;
  cityName?: string;
}) {
  const location = cityName ? `${cityName}, ${stateAbbr}` : stateName;
  const faqs = [
    {
      q: `Is Spinora available in ${location}?`,
      a: `Yes — Spinora serves players across ${stateName}${cityName ? `, including ${cityName}` : ""}. Our sweepstakes fish table and slot games are playable online from ${location}.`,
    },
    {
      q: `How do I get started from ${location}?`,
      a: `Create a free Spinora account, deposit via CashApp, Zelle, Bitcoin or USDT, then create a game account and load credits from your wallet.`,
    },
    {
      q: `How fast is support for ${location} players?`,
      a: `Live chat and dashboard messages are available 24/7. Most deposit and account requests are handled within minutes.`,
    },
  ];

  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h2 className="mb-6 text-xl font-bold">Questions from {location} players</h2>
      <div className="space-y-4">
        {faqs.map(({ q, a }) => (
          <GlassCard key={q} className="p-5">
            <h3 className="font-semibold">{q}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{a}</p>
          </GlassCard>
        ))}
      </div>
    </section>
  );
}

export function GeoPageTemplate({ state, city }: GeoPageTemplateProps) {
  const locationName = city ? `${city.name}, ${state.abbr}` : state.name;
  const lede = city?.descriptionSnippet ?? state.heroLede;

  return (
    <>
      <Navbar />
      <main className="pt-24 pb-16">
        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <Link href="/" className="hover:text-foreground">
              Home
            </Link>
            <ChevronRight className="size-3" aria-hidden />
            {city && (
              <>
                <Link href={`/${state.slug}`} className="hover:text-foreground">
                  {state.name}
                </Link>
                <ChevronRight className="size-3" aria-hidden />
              </>
            )}
            <span className="text-foreground">{locationName}</span>
          </nav>

          <p className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-orange-400">
            <MapPin className="size-3.5" aria-hidden />
            {locationName}
          </p>
          <h1 className="max-w-3xl text-3xl font-bold sm:text-4xl">
            Play sweepstakes games online in{" "}
            <span className="gradient-text">{locationName}</span>
          </h1>
          <p className="mt-4 max-w-2xl text-muted-foreground leading-relaxed">{lede}</p>

          {state.heroImageUrl && (
            <div className="mt-6 overflow-hidden rounded-2xl border border-border/60 max-w-3xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={state.heroImageUrl}
                alt={`${locationName} online gaming`}
                className="w-full h-48 sm:h-64 object-cover"
              />
            </div>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/register">Create free account</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/games">Browse games</Link>
            </Button>
          </div>
        </section>

        {!city && state.cities.length > 0 && (
          <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
            <h2 className="mb-4 text-lg font-semibold">Popular cities in {state.name}</h2>
            <div className="flex flex-wrap gap-2">
              {state.cities.map((c) => (
                <Link
                  key={c.slug}
                  href={`/${state.slug}/${c.slug}`}
                  className="rounded-full border border-white/10 bg-[#1a1a1a] px-4 py-2 text-sm hover:border-orange-500/40"
                >
                  {c.name}
                </Link>
              ))}
            </div>
          </section>
        )}

        <MarketingGameGrid
          title={`Games available in ${locationName}`}
          lede={`All Spinora games are playable online from ${locationName}. Create your account, deposit, and load credits in minutes.`}
        />

        <GeoFaqs stateName={state.name} stateAbbr={state.abbr} cityName={city?.name} />

        <section className="mx-auto max-w-7xl px-4 py-12 text-center sm:px-6">
          <h2 className="text-2xl font-bold">Ready to play from {locationName}?</h2>
          <p className="mt-2 text-muted-foreground">Instant accounts · Fast deposits · 24/7 support</p>
          <Button asChild className="mt-6">
            <Link href="/dashboard/deposit">Add funds &amp; play</Link>
          </Button>
        </section>
      </main>
      <Footer />
    </>
  );
}
