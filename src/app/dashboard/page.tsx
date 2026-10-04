import Link from "next/link";
import {
  BadgeCheck,
  Bell,
  ChevronRight,
  Gift,
  History,
  Lock,
  MessageCircle,
  Shield,
  Sparkles,
  User,
  Wallet,
} from "lucide-react";
import { getDashboardCore } from "@/lib/data/dashboard";
import { ClaimVerifyBanner } from "@/components/player/claim-verify-banner";
import { SignOutButton } from "@/components/player/sign-out-button";
import { SITE_NAME } from "@/lib/constants";

const GRID = [
  { href: "/dashboard/wallet", label: "Wallet", icon: Wallet },
  { href: "/dashboard/withdraw", label: "Cash out", icon: Sparkles },
  { href: "/dashboard/activity", label: "Activity", icon: History },
  { href: "/dashboard/kyc", label: "Security", icon: Lock },
  { href: "/support", label: "Support", icon: MessageCircle },
  { href: "/terms", label: "Responsible play", icon: Shield },
];

const HELP = [
  { href: "/dashboard/messages", label: "Inbox" },
  { href: "/dashboard/notifications", label: "Notification settings" },
  { href: "/support", label: "Help & FAQ" },
];

const PROGRESS = [
  { href: "/dashboard/vip", label: "VIP" },
  { href: "/dashboard/rewards", label: "Rewards" },
  { href: "/dashboard/achievements", label: "Achievements" },
  { href: "/dashboard/referrals", label: "Refer & earn" },
];

const LEGAL = [
  { href: "/terms", label: "Program rules" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
];

export default async function AccountHubPage() {
  const { profile, tier } = await getDashboardCore();
  const row = profile as typeof profile & {
    kyc_status?: string | null;
    email?: string | null;
    phone?: string | null;
    display_name?: string | null;
    username?: string | null;
  };
  const name = row.display_name ?? row.username ?? row.full_name ?? row.email?.split("@")[0] ?? "Player";
  const kyc = row.kyc_status === "verified" ? 1 : 0;
  const phone = row.phone ? 1 : 0;
  const emailOk = row.email ? 1 : 0;
  const verified = kyc + phone + emailOk;
  const needsVerify = verified < 3;

  return (
    <div className="space-y-6">
      {needsVerify ? (
        <ClaimVerifyBanner
          href="/dashboard/kyc"
          title="Finish this to keep cash-outs moving"
          body={`${verified} of 3 verified`}
          cta="Finish"
        />
      ) : null}

      <div>
        <h1 className="text-3xl font-extrabold">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your account, settings, and help.</p>
      </div>

      <section className="overflow-hidden rounded-[24px] bg-[#121826]">
        <div className="bg-gradient-to-br from-rose-600/35 via-[#1a2233] to-[#0b0e14] px-5 py-8">
          <p className="text-xl font-extrabold">Your account, in one place</p>
          <p className="mt-1 text-sm text-white/70">{SITE_NAME}</p>
        </div>
      </section>

      <div className="hub-card flex items-center gap-4 rounded-[24px] p-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/20 text-lg font-bold">
          <User className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-extrabold">{name}</p>
          <p className="truncate text-sm text-muted-foreground">{row.email}</p>
        </div>
        <Link href="/dashboard/kyc" className="text-sm font-semibold text-primary">
          Edit
        </Link>
      </div>

      <Link href="/dashboard/kyc" className="hub-card flex items-center gap-3 rounded-2xl p-4">
        <BadgeCheck className="h-5 w-5 text-primary" />
        <div className="flex-1">
          <p className="font-semibold">{verified} of 3 verified</p>
          <p className="text-sm text-muted-foreground">Finish this to keep cash-outs moving</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </Link>

      <div>
        <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Account essentials
        </p>
        <div className="grid grid-cols-2 gap-3">
          {GRID.map((item) => (
            <Link key={item.href + item.label} href={item.href} className="hub-card rounded-2xl p-4">
              <item.icon className="mb-2 h-5 w-5 text-primary" />
              <p className="font-semibold">{item.label}</p>
            </Link>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Messages & help
        </p>
        {HELP.map((item) => (
          <Link key={item.href} href={item.href} className="hub-card flex items-center justify-between rounded-2xl px-4 py-3">
            <span className="flex items-center gap-2 font-medium">
              <Bell className="h-4 w-4 text-primary" /> {item.label}
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        ))}
      </div>

      <div className="space-y-2">
        <p className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Rewards & progress
        </p>
        {tier ? (
          <p className="px-1 text-sm text-muted-foreground">VIP · {tier.name}</p>
        ) : null}
        {PROGRESS.map((item) => (
          <Link key={item.href} href={item.href} className="hub-card flex items-center justify-between rounded-2xl px-4 py-3">
            <span className="flex items-center gap-2 font-medium">
              <Gift className="h-4 w-4 text-primary" /> {item.label}
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        ))}
      </div>

      <div className="space-y-2">
        <p className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rules & app</p>
        {LEGAL.map((item) => (
          <Link key={item.label} href={item.href} className="block px-1 py-2 text-sm text-muted-foreground">
            {item.label}
          </Link>
        ))}
      </div>

      <SignOutButton />
    </div>
  );
}
