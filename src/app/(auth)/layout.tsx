import Image from "next/image";
import Link from "next/link";
import { SITE_NAME } from "@/lib/constants";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0b0e14]">
      <div className="relative overflow-hidden bg-[#121826] px-6 pb-16 pt-10 text-center">
        <Link href="/" className="mb-6 inline-flex items-center gap-2">
          <Image src="/logo.webp" alt="" width={40} height={40} className="rounded-xl" />
          <span className="font-extrabold">{SITE_NAME}</span>
        </Link>
        <div className="relative mx-auto h-28 w-28">
          <Image src="/logo.webp" alt={SITE_NAME} fill className="object-contain" priority />
        </div>
        <p className="mt-3 text-sm text-muted-foreground">Play for free · Win real rewards</p>
      </div>
      <div className="-mt-8 px-4 pb-10">
        <div className="mx-auto w-full max-w-md rounded-[24px] bg-white p-6 text-zinc-900 shadow-2xl [&_.text-foreground]:text-zinc-900 [&_.text-muted-foreground]:text-zinc-500 [&_.text-primary]:text-rose-600">
          {children}
        </div>
        <p className="mx-auto mt-6 max-w-md text-center text-xs text-muted-foreground">
          Encrypted · Secure · Play responsibly · 18+
        </p>
      </div>
    </div>
  );
}
