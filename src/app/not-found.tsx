import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page not found | Sweepstakes Hub",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-6 py-24 text-center">
      <p className="text-sm font-semibold uppercase tracking-wider text-primary">404</p>
      <h1 className="mt-3 text-3xl font-extrabold">That page is not on this site.</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        The address does not match a public page. Use the lobby, the game list, or help.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-white">
          Home
        </Link>
        <Link href="/play" className="rounded-full border border-white/15 px-5 py-2 text-sm font-bold">
          Game Rooms
        </Link>
        <Link href="/help" className="rounded-full border border-white/15 px-5 py-2 text-sm font-bold">
          Help
        </Link>
      </div>
    </main>
  );
}
