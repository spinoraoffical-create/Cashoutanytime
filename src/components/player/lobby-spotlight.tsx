import Image from "next/image";
import Link from "next/link";

export function LobbySpotlight({
  href = "/play",
  heading = "h2",
}: {
  href?: string;
  heading?: "h1" | "h2";
}) {
  const Title = heading;
  return (
    <div className="text-left">
      <section className="relative min-h-[228px] overflow-hidden rounded-[22px] bg-[#071018]">
        <Image
          src="/brand/sweepstakes-hub.jpg"
          alt="Sweepstakes Hub"
          fill
          priority
          sizes="(min-width: 1024px) 760px, 100vw"
          className="object-cover object-[68%_center]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#071018] via-[#071018]/90 to-[#071018]/10" />
        <div className="relative flex min-h-[228px] flex-col justify-between p-5">
          <div>
            <Title className="max-w-[210px] text-[32px] font-black leading-[0.95] tracking-tight text-white">
              Pick your next game.
            </Title>
            <p className="mt-2 text-sm font-medium text-white/80">Game Rooms</p>
            <Link
              href={href}
              className="mt-4 inline-flex rounded-full bg-[#f3264f] px-4 py-2.5 text-sm font-bold text-white"
            >
              Browse games →
            </Link>
          </div>
          <p className="mt-6 max-w-[260px] text-sm text-white/90">
            Each game keeps its own account and balance.
          </p>
        </div>
      </section>
      <div className="mt-3 flex items-center justify-center" aria-hidden>
        <span className="h-1.5 w-6 rounded-full bg-[#f4c64e]" />
      </div>
    </div>
  );
}
