import { notFound } from "next/navigation";
import { GamePageShell } from "@/components/games/game-page-shell";
import { createMetadata } from "@/lib/seo/metadata";
import { getGameSeoDescription, getGameSeoKeywords, getGameSeoTitle } from "@/lib/seo/game-seo";
import { BreadcrumbSchema, GamePageSchema } from "@/lib/seo/json-ld";
import { SITE_URL } from "@/lib/constants";
import { canonicalGameSlug, getGameBySlug, type Game } from "@/lib/games";
import { getGames } from "@/lib/data/marketing";
import { marketingGamesToCards } from "@/lib/games-marketing";
import { isWalletLoadEnabledForGame } from "@/lib/game-automation/config";
import { gameIsActive, getMyGameAccount } from "@/lib/actions/game-loads";

export const dynamic = "force-dynamic";

interface GamePageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ create?: string }>;
}

async function visibleGame(slug: string): Promise<Game | null> {
  if (!(await gameIsActive(slug))) return null;
  const local = getGameBySlug(slug);
  if (local) return local;
  const key = canonicalGameSlug(slug);
  return marketingGamesToCards(await getGames()).find((game) => canonicalGameSlug(game.slug) === key) ?? null;
}

export async function generateMetadata({ params }: GamePageProps) {
  const { slug } = await params;
  const game = await visibleGame(slug);
  if (!game) return { title: "Not found", robots: { index: false, follow: false } };

  return createMetadata({
    title: getGameSeoTitle(game),
    description: getGameSeoDescription(game),
    keywords: getGameSeoKeywords(game),
    path: `/games/${game.slug}`,
    ogImage: game.image,
  });
}

export default async function GamePage({ params, searchParams }: GamePageProps) {
  const { slug } = await params;
  const { create } = await searchParams;
  const game = await visibleGame(slug);
  if (!game) notFound();

  const walletLoadEnabled = isWalletLoadEnabledForGame(game.slug);
  const initialGameAccount = walletLoadEnabled ? await getMyGameAccount(game.slug) : null;

  return (
    <>
      <BreadcrumbSchema
        items={[
          { name: "Home", url: SITE_URL },
          { name: game.name, url: `${SITE_URL}/games/${game.slug}` },
        ]}
      />
      <GamePageSchema game={game} />
      <GamePageShell
        game={game}
        autoCreate={create === "1"}
        walletLoadEnabled={walletLoadEnabled}
        initialGameAccount={initialGameAccount}
      />
    </>
  );
}
