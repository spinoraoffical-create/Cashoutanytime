import { DollarPayDepositSection } from "@/components/payments/dollarpay-deposit-modal";
import type { Game } from "@/lib/games";

interface GameDepositSectionProps {
  game: Game;
  /** Hide scroll anchor when rendered on /dashboard/deposit */
  hideSectionAnchor?: boolean;
}

export function GameDepositSection({ game, hideSectionAnchor }: GameDepositSectionProps) {
  return (
    <section id={hideSectionAnchor ? undefined : "deposit"} className="scroll-mt-24">
      <DollarPayDepositSection gameSlug={game.slug} gameName={game.name} />
    </section>
  );
}
