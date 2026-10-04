import Image from "next/image";
import Link from "next/link";
import {
  BadgeCheck,
  ChevronRight,
  Headphones,
  Landmark,
  ShieldCheck,
  Sparkles,
  Timer,
  UserPlus,
  Wallet,
} from "lucide-react";
import { SITE_NAME } from "@/lib/constants";
import { getGameRooms, type Game } from "@/lib/games";
import { Button } from "@/components/ui/button";

function RoomCard({ game }: { game: Game }) {
  return (
    <Link
      href={`/games/${game.slug}`}
      className="hub-card w-[148px] shrink-0 overflow-hidden rounded-2xl"
    >
      <div className="relative h-28 w-full bg-white/5">
        <Image src={game.image} alt="" fill className="object-cover" />
      </div>
      <div className="p-3">
        <p className="truncate text-sm font-bold">{game.name}</p>
        <p className="text-xs text-muted-foreground">Load + redeem</p>
      </div>
    </Link>
  );
}

export function PublicHome({ games }: { games?: Game[] }) {
  const rooms = (games?.length ? games : getGameRooms()).filter((g) => !g.upcoming);
  const slots = rooms.filter((g) => /slot/i.test(g.category));
  const fish = rooms.filter((g) => /fish/i.test(g.category));

  return (
    <div className="mx-auto max-w-lg space-y-10 pb-28 lg:max-w-3xl">
      <section className="overflow-hidden rounded-[24px] bg-[#121826] text-center">
        <div className="flex justify-between px-4 pt-4">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.webp" alt="" width={36} height={36} className="rounded-xl" />
            <span className="text-left text-sm font-extrabold leading-tight">
              {SITE_NAME}
            </span>
          </Link>
          <div className="flex gap-2">
            <Button asChild variant="secondary" size="sm" className="rounded-full">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm" className="rounded-full">
              <Link href="/register">Join</Link>
            </Button>
          </div>
        </div>
        <div className="relative mx-auto mt-4 h-52 w-52">
          <Image src="/logo.webp" alt={SITE_NAME} fill className="object-contain drop-shadow-2xl" priority />
        </div>
        <div className="space-y-3 px-6 pb-8 pt-2">
          <h1 className="text-3xl font-extrabold tracking-tight">
            Play sweepstakes games.
            <br />
            Keep money destinations clear.
          </h1>
          <p className="text-sm text-muted-foreground">
            Load credits into Game Rooms, redeem winnings to cash out, and track every move in Activity.
          </p>
          <Button asChild size="lg" className="w-full rounded-full">
            <Link href="/register">Join {SITE_NAME}</Link>
          </Button>
          <p className="text-xs text-muted-foreground">Encrypted · Secure · 18+</p>
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-xl font-extrabold">Built to feel simple</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          The important parts stay visible before you fund, load, or redeem.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: Timer, title: "Fast cash outs", body: "Redeem from a Game Room, then cash out from your wallet." },
            { icon: ShieldCheck, title: "Secure account", body: "Verify identity when cashing out. Keep one login." },
            { icon: Headphones, title: "Human support", body: "Private chat for balances and payments after you sign in." },
            { icon: Sparkles, title: "VIP & rewards", body: "Daily spin, referrals, and VIP tiers on your account." },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="hub-card rounded-2xl p-4">
              <Icon className="mb-2 h-5 w-5 text-primary" />
              <p className="text-sm font-bold">{title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="text-xl font-extrabold">Game Rooms</h2>
            <p className="text-sm text-muted-foreground">Load + redeem · {rooms.length} rooms</p>
          </div>
          <Link href="/play" className="text-sm font-semibold text-primary">
            See all
          </Link>
        </div>
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 scrollbar-hide">
          {rooms.slice(0, 8).map((g) => (
            <RoomCard key={g.slug} game={g} />
          ))}
        </div>
      </section>

      {slots.length > 0 && (
        <section>
          <div className="mb-3 flex items-end justify-between">
            <h2 className="text-xl font-extrabold">Slots & tables</h2>
            <Link href="/play" className="text-sm font-semibold text-primary">
              See all
            </Link>
          </div>
          <div className="space-y-2">
            {slots.slice(0, 4).map((g) => (
              <Link
                key={g.slug}
                href={`/games/${g.slug}`}
                className="hub-card flex items-center gap-3 rounded-2xl p-2 pr-3"
              >
                <div className="relative h-14 w-14 overflow-hidden rounded-xl bg-white/5">
                  <Image src={g.image} alt="" fill className="object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{g.name}</p>
                  <p className="text-xs text-muted-foreground">{g.provider}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {fish.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-extrabold">Fish tables</h2>
          <div className="grid grid-cols-2 gap-3">
            {fish.slice(0, 4).map((g) => (
              <Link key={g.slug} href={`/games/${g.slug}`} className="hub-card overflow-hidden rounded-2xl">
                <div className="relative h-24 w-full bg-white/5">
                  <Image src={g.image} alt="" fill className="object-cover" />
                </div>
                <div className="p-3">
                  <p className="truncate text-sm font-bold">{g.name}</p>
                  <p className="text-xs text-muted-foreground">{g.provider}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="hub-card space-y-4 rounded-[24px] p-5">
        <h2 className="text-xl font-extrabold">One account. Clear destinations.</h2>
        <p className="text-sm text-muted-foreground">
          Money language stays literal so you know what moves and what stays separate.
        </p>
        <ul className="space-y-3 text-sm">
          <li className="flex gap-3">
            <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              <strong>Main Wallet</strong> — add money and cash out.
            </span>
          </li>
          <li className="flex gap-3">
            <Landmark className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              <strong>Game Room balances</strong> — load into a title, then redeem back.
            </span>
          </li>
          <li className="flex gap-3">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              <strong>Freeplay</strong> — bonus credits for play where shown. Not cash.
            </span>
          </li>
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-extrabold">From hello to play</h2>
        <ol className="space-y-3">
          {[
            { n: "1", t: "Create your account", d: "Sign up and complete any checks shown for cash out." },
            { n: "2", t: "Pick a destination", d: "Open a Game Room and load from Main Wallet." },
            { n: "3", t: "Review the balance", d: "See cash, freeplay, and room balances before you confirm." },
            { n: "4", t: "Track every action", d: "Activity keeps deposits, loads, redeems, and cash outs visible." },
          ].map((s) => (
            <li key={s.n} className="hub-card flex gap-3 rounded-2xl p-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
                {s.n}
              </span>
              <div>
                <p className="font-bold">{s.t}</p>
                <p className="text-sm text-muted-foreground">{s.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-3 pb-4">
        <h2 className="text-xl font-extrabold">Help stays human</h2>
        <div className="grid grid-cols-2 gap-3">
          <Link href="/support" className="hub-card rounded-2xl p-4 font-semibold">
            Get support
          </Link>
          <Link href="/terms" className="hub-card rounded-2xl p-4 font-semibold">
            Responsible play
          </Link>
          <Link href="/terms" className="hub-card rounded-2xl p-4 text-sm text-muted-foreground">
            Terms
          </Link>
          <Link href="/privacy" className="hub-card rounded-2xl p-4 text-sm text-muted-foreground">
            Privacy
          </Link>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Eligibility, age, and location rules apply. 18+ only.
        </p>
      </section>
    </div>
  );
}

export function LoggedInHomeStrip({
  games,
  kycStatus,
}: {
  games: Game[];
  kycStatus?: string | null;
}) {
  const rooms = games.filter((g) => !g.upcoming);
  const needsKyc = kycStatus && kycStatus !== "verified";

  return (
    <div className="space-y-6">
      {needsKyc && (
        <Link
          href="/dashboard/kyc"
          className="hub-card flex items-center gap-3 rounded-2xl p-4"
        >
          <BadgeCheck className="h-5 w-5 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="font-bold">Verify to cash out</p>
            <p className="text-sm text-muted-foreground">Finish ID checks before redeeming.</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      )}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">Game Rooms</h1>
          <p className="text-sm text-muted-foreground">Load + redeem</p>
        </div>
        <Link href="/play" className="text-sm font-semibold text-primary">
          See all
        </Link>
      </div>
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 scrollbar-hide">
        {rooms.slice(0, 10).map((g) => (
          <RoomCard key={g.slug} game={g} />
        ))}
      </div>
      <Link
        href="/spin"
        className="flex items-center justify-between rounded-2xl bg-emerald-600 px-5 py-4 font-bold text-white"
      >
        <span className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" /> Claim daily freeplay spin
        </span>
        <ChevronRight className="h-5 w-5" />
      </Link>
    </div>
  );
}
