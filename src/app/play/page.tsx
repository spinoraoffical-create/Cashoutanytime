import Link from "next/link";
import { Suspense } from "react";
import { PlayCatalog } from "@/components/player/play-catalog";
import { VipPageLayout } from "@/components/layout/vip-page-layout";
import { loadActiveGames } from "@/lib/data/marketing";
import { gameDetailPath, publicPlayCatalog } from "@/lib/games-marketing";
import { withPageSocial } from "@/lib/seo/metadata";

export const metadata = withPageSocial({
  title: "Play | Sweepstakes Hub",
  description: "Browse the Game Rooms that are turned on at Sweepstakes Hub, then open a game page to see how that room works.",
  path: "/play",
});

export default async function PlayPage() {
  const loaded = await loadActiveGames();
  const games = loaded.status === "ready" ? publicPlayCatalog(loaded.games) : [];

  return (
    <VipPageLayout>
      <main>
        <section className="mb-4">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#ff6b89]">Game Room catalog</p>
          <h1 className="mt-1 text-4xl font-black leading-10">Find your game</h1>
          <p className="mt-2 max-w-xl text-sm text-[#b9b3c6]">
            These are the Game Rooms currently available on Sweepstakes Hub. Open a room for its public page.
          </p>
          {loaded.status === "unavailable" ? (
            <p className="mt-4 text-sm text-[#b9b3c6]">The game list could not be loaded. Refresh the page.</p>
          ) : games.length > 0 ? (
            <ul className="mt-4 flex flex-wrap gap-2">
              {games.map((game) => (
                <li key={game.id}>
                  <Link
                    href={gameDetailPath(game.slug)}
                    className="inline-flex rounded-full bg-white/8 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/12"
                  >
                    {game.name}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-[#b9b3c6]">No Game Rooms are turned on right now.</p>
          )}
        </section>
        <Suspense fallback={null}>
          <PlayCatalog games={games} />
        </Suspense>
      </main>
    </VipPageLayout>
  );
}
