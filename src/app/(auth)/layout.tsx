import Image from "next/image";
import Link from "next/link";
import { SITE_NAME } from "@/lib/constants";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center bg-gradient-to-br from-purple-900/30 via-background to-blue-900/30">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-600/10 via-transparent to-transparent" />
        <div className="relative text-center p-12">
          <Image src="/logo.webp" alt={SITE_NAME} width={200} height={200} className="mx-auto rounded-2xl glow-purple mb-8" priority />
          <h2 className="text-3xl font-bold gradient-text mb-4">{SITE_NAME}</h2>
          <p className="text-muted-foreground max-w-sm">
            Sign in with email. We save your email and phone for support and account recovery.
          </p>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <Link href="/" className="lg:hidden flex items-center gap-2 mb-8 justify-center">
            <Image src="/logo.webp" alt={SITE_NAME} width={32} height={32} className="rounded-lg" />
            <span className="font-bold gradient-text">{SITE_NAME}</span>
          </Link>
          {children}
        </div>
      </div>
    </div>
  );
}
