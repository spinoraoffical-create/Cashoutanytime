import Image from "next/image";
import Link from "next/link";
import { SITE_NAME } from "@/lib/constants";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#07060f] lg:grid lg:grid-cols-2">
      <aside className="relative min-h-[220px] overflow-hidden lg:min-h-screen">
        <Image
          src="/auth/casino-floor.jpg"
          alt="Sweepstakes Hub casino floor"
          fill
          priority
          className="object-cover"
          sizes="(min-width: 1024px) 50vw, 100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#07060f] via-[#07060f]/55 to-[#07060f]/20 lg:bg-gradient-to-r lg:from-[#07060f]/30 lg:via-[#07060f]/25 lg:to-[#07060f]/70" />
        <div className="relative z-10 flex h-full flex-col justify-between p-6 text-white lg:p-12">
          <Link href="/" className="inline-flex w-fit items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-xs font-black text-white shadow-[0_0_24px_rgba(255,45,85,0.45)]">
              SH
            </span>
            <span className="font-extrabold">{SITE_NAME}</span>
          </Link>
          <div className="max-w-lg pb-2 lg:pb-16">
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
              Welcome back to the floor.
            </h1>
            <p className="mt-3 max-w-md text-sm text-white/80 sm:text-base">
              Your wallet, games, and account stay in one place.
            </p>
            <ul className="mt-8 hidden gap-6 text-sm sm:grid sm:grid-cols-3 lg:max-w-xl">
              <li>
                <p className="font-semibold">Protected</p>
                <p className="text-white/70">Secure account access</p>
              </li>
              <li>
                <p className="font-semibold">Clear</p>
                <p className="text-white/70">Balances stay separate</p>
              </li>
              <li>
                <p className="font-semibold">Human</p>
                <p className="text-white/70">Help when you need it</p>
              </li>
            </ul>
          </div>
        </div>
      </aside>

      <main className="flex items-center justify-center bg-[#f4f1f6] px-4 py-8 text-zinc-900 lg:px-10">
        <div className="auth-panel w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl sm:p-8">
          {children}
          <p className="mt-6 text-center text-[11px] text-zinc-500">
            Play responsibly · 18+ · Encrypted
          </p>
        </div>
      </main>
    </div>
  );
}
