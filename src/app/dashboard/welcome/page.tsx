import { PlayerSubpage } from "@/components/player/player-subpage";
import { WelcomeBonusPanel } from "@/components/player/welcome-bonus-panel";
import { getProfileEditorState } from "@/lib/actions/profile";

export default async function WelcomeBonusPage() {
  const profile = await getProfileEditorState();
  return (
    <PlayerSubpage title="Welcome reward" subtitle="New players. 18+ only. Freeplay is not directly withdrawable.">
      <WelcomeBonusPanel profile={profile} />
    </PlayerSubpage>
  );
}
