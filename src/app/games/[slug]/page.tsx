import { notFound } from "next/navigation";
import { GamePageShell } from "@/components/games/game-page-shell";
import { createMetadata } from "@/lib/seo/metadata";
import { getGameSeoDescription, getGameSeoKeywords, getGameSeoTitle } from "@/lib/seo/game-seo";
import { BreadcrumbSchema, GamePageSchema } from "@/lib/seo/json-ld";
import { SITE_URL } from "@/lib/constants";
import { GAMES, getGameBySlug } from "@/lib/games";
import { isWalletLoadEnabledForGame } from "@/lib/game-automation/config";
import { getMyGameAccount } from "@/lib/actions/game-loads";

export const dynamic = "force-dynamic";

interface GamePageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ create?: string }>;
}

export function generateStaticParams() {
  return GAMES.map((game) => ({ slug: game.slug }));
}

export async function generateMetadata({ params }: GamePageProps) {
  const { slug } = await params;
  const game = getGameBySlug(slug);
  if (!game) return {};

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
  const game = getGameBySlug(slug);

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
