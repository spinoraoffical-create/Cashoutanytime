"use client";

const TICKER_ITEMS: [string, string, string][] = [
  ["Alex M.", "won $240 on", "Fire Kirin"],
  ["Diana L.", "reached", "Gold VIP 🏆"],
  ["Chris P.", "joined via referral — earned", "+10 pts"],
  ["Emma W.", "set up account on", "Juwa"],
  ["Ryan B.", "claimed", "$50 bonus"],
  ["Marco T.", "won $180 on", "Panda Master"],
  ["Lisa K.", "upgraded to", "Platinum VIP 💎"],
  ["James R.", "referred 3 friends — earned", "+300 pts"],
];

function TickerItem({ user, action, highlight }: { user: string; action: string; highlight: string }) {
  return (
    <span className="inline-flex items-center gap-2 px-6 whitespace-nowrap text-sm">
      <span className="inline-flex rounded-full h-2 w-2 bg-green-400 shrink-0" aria-hidden />
      <span className="font-semibold text-purple-400">{user}</span>
      <span className="text-white/90">{action}</span>
      <span className="font-bold text-amber-400">{highlight}</span>
    </span>
  );
}

export function MarqueeTicker() {
  return (
    <div className="marquee-wrapper relative bg-[#0d0318] border-y border-purple-900/40 overflow-hidden">
      <div className="marquee-track flex w-max hover:[animation-play-state:paused]">
        {[...TICKER_ITEMS, ...TICKER_ITEMS].map(([user, action, highlight], i) => (
          <TickerItem key={`${user}-${i}`} user={user} action={action} highlight={highlight} />
        ))}
      </div>
    </div>
  );
}
