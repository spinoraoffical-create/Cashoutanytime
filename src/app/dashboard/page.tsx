import Link from "next/link";
import Image from "next/image";
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
  Wallet,
} from "lucide-react";
import { getDashboardCore } from "@/lib/data/dashboard";
import { getProfileEditorState } from "@/lib/actions/profile";
import { ProfileIdentityCard } from "@/components/player/profile-identity-card";
import { ClaimVerifyBanner } from "@/components/player/claim-verify-banner";
import { SignOutButton } from "@/components/player/sign-out-button";
import { PlayerVideoGuides } from "@/components/player/player-video-guides";
import { ProfilePreferences } from "@/components/player/profile-preferences";
import { MotionPage } from "@/components/player/motion-page";

const GRID = [
  { href: "/dashboard/wallet", label: "Wallet", hint: "Balances & methods", icon: Wallet },
  { href: "/dashboard/withdraw", label: "Cash out", hint: "Payout options", icon: Sparkles },
  { href: "/dashboard/activity", label: "Activity", hint: "Transactions & status", icon: History },
  { href: "/dashboard/security", label: "Security", hint: "Password & sign-in", icon: Lock },
  { href: "/support", label: "Support", hint: "Chat with our team", icon: MessageCircle },
  { href: "/dashboard/responsible", label: "Responsible play", hint: "Limits & time-outs", icon: Shield },
];

const HELP = [
  { href: "/dashboard/messages", label: "Inbox" },
  { href: "/dashboard/notifications", label: "Notification settings" },
  { href: "/support", label: "Help & FAQ" },
];

const PROGRESS = [
  { href: "/dashboard/vip", label: "VIP" },
  { href: "/dashboard/rewards", label: "Rewards & bonuses" },
  { href: "/dashboard/missions", label: "Missions" },
  { href: "/dashboard/achievements", label: "Achievements" },
  { href: "/dashboard/referrals", label: "Refer & earn" },
];

const LEGAL = [
  { href: "/terms", label: "Program rules" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
];

export default async function AccountHubPage() {
  const [{ tier }, editor] = await Promise.all([getDashboardCore(), getProfileEditorState()]);
  const row = editor;
  const kyc = row.kycStatus === "verified" || row.kycStatus === "approved" ? 1 : 0;
  const phone = row.phone ? 1 : 0;
  const emailOk = row.emailVerified ? 1 : 0;
  const verified = kyc + phone + emailOk;
  const needsVerify = verified < 3;

  return (
    <MotionPage className="space-y-6">
      {needsVerify ? (
        <ClaimVerifyBanner
          href="/dashboard/welcome"
          title="Get $5 free play — just verify your email & phone"
          body="No deposit needed. Verify your email and phone number to unlock free play. New players — tap to see the details and claim."
          cta="Claim now"
        />
      ) : null}

      <div>
        <h1 className="text-3xl font-extrabold">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your account status, controls, and help.</p>
      </div>

      <section className="relative overflow-hidden rounded-[24px]">
        <div className="relative h-40 w-full">
          <Image src="/games/game-vault.webp" alt="" fill sizes="480px" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#120818] via-[#120818]/85 to-[#120818]/25" />
          <div className="absolute inset-0 flex flex-col justify-end p-5">
            <p className="max-w-[220px] text-2xl font-extrabold leading-tight">Your account, in one place.</p>
            <p className="mt-1 max-w-[220px] text-sm text-white/70">Review identity, security, preferences, and help.</p>
          </div>
        </div>
      </section>

      <ProfileIdentityCard profile={editor} />

      <Link href="/dashboard/verification" className="hub-card flex items-center gap-3 rounded-2xl p-4">
        <BadgeCheck className="h-5 w-5 text-primary" />
        <div className="flex-1">
          <p className="font-semibold">{verified} of 3 verified</p>
          <p className="text-sm text-muted-foreground">Finish this to keep cash-outs moving</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </Link>

      <div>
        <p className="mb-1 px-1 text-xl font-extrabold">Account essentials</p>
        <p className="mb-3 px-1 text-sm text-muted-foreground">Money, security, and help.</p>
        <div className="grid grid-cols-2 gap-3">
          {GRID.map((item) => (
            <Link key={item.href + item.label} href={item.href} className="hub-card rounded-2xl p-4">
              <item.icon className="mb-3 h-5 w-5 text-primary" />
              <p className="font-semibold">{item.label}</p>
              <p className="text-xs text-zinc-400">{item.hint}</p>
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

      <Link href="/dashboard/referrals" className="hub-card block rounded-2xl p-4">
        <p className="font-bold">Affiliate program</p>
        <p className="text-sm text-zinc-400">Share your link and track who joins from it.</p>
      </Link>

      <ProfilePreferences />

      <PlayerVideoGuides />

      <SignOutButton />
    </MotionPage>
  );
}
