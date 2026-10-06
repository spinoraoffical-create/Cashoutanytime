import Link from "next/link";
import { PlayerSubpage } from "@/components/player/player-subpage";
import { getProfileEditorState } from "@/lib/actions/profile";
import { getWalletData } from "@/lib/data/dashboard";

export default async function MissionsPage() {
  const [profile, wallet] = await Promise.all([getProfileEditorState(), getWalletData()]);
  const deposited = wallet.transactions.some((tx) => tx.source === "deposit");
  const idDone = profile.kycStatus === "verified" || profile.kycStatus === "approved";
  const missions = [
    { title: "Verify your email", done: profile.emailVerified, href: "/dashboard/welcome" },
    { title: "Add your phone", done: Boolean(profile.phone), href: "/dashboard/welcome" },
    { title: "Verify your ID", done: idDone, href: "/dashboard/kyc" },
    { title: "Add money to your wallet", done: deposited, href: "/dashboard/deposit" },
    { title: "Open a Game Room", done: false, href: "/play" },
  ];
  const done = missions.filter((mission) => mission.done).length;

  return (
    <PlayerSubpage title="Missions" subtitle={`${done} of ${missions.length} finished. Each one uses your real account.`}>
      <div className="hub-card divide-y divide-white/8 rounded-[24px]">
        {missions.map((mission) => (
          <Link key={mission.title} href={mission.href} className="flex items-center justify-between gap-3 p-4">
            <div>
              <p className="font-bold">{mission.title}</p>
              <p className="text-xs text-zinc-400">{mission.done ? "Done" : "Open"}</p>
            </div>
            <span className={mission.done ? "text-sm font-semibold text-emerald-400" : "text-sm font-semibold text-primary"}>
              {mission.done ? "Done" : "Go"}
            </span>
          </Link>
        ))}
      </div>
    </PlayerSubpage>
  );
}
