import Link from "next/link";
import Image from "next/image";
import {
  BadgeCheck,
  Bell,
  ChevronRight,
  Download,
  FileText,
  Gift,
  HelpCircle,
  History,
  Lock,
  MessageCircle,
  ScrollText,
  Shield,
  Sparkles,
  Wallet,
} from "lucide-react";
import { AccountInboxLink, WhatsNewLink } from "@/components/player/account-inbox-link";
import { getDashboardCore } from "@/lib/data/dashboard";
import { getProfileEditorState } from "@/lib/actions/profile";
import { ProfileIdentityCard } from "@/components/player/profile-identity-card";
import { ClaimVerifyBanner } from "@/components/player/claim-verify-banner";
import { SignOutButton } from "@/components/player/sign-out-button";
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
  { href: "/help", label: "Help & FAQ" },
];

const PROGRESS = [
  { href: "/dashboard/rewards", label: "Rewards & bonuses", icon: Gift },
  { href: "/dashboard/missions", label: "Missions", icon: Sparkles },
  { href: "/dashboard/achievements", label: "Achievements", icon: BadgeCheck },
];

const RULES = [
  { href: "/terms", label: "Program rules", icon: ScrollText },
  { href: "/get-app", label: "Install or update app", icon: Download },
  { href: "/terms", label: "Terms of Service", icon: FileText },
  { href: "/whats-new", label: "What's new", icon: Sparkles, dot: true },
];

export default async function AccountHubPage() {
  const [{ tier, nextTier, profile }, editor] = await Promise.all([
    getDashboardCore(),
    getProfileEditorState(),
  ]);
  const xp = Number((profile as { xp?: number; vip_points?: number }).xp ?? (profile as { vip_points?: number }).vip_points ?? 0);
  const xpToNext = nextTier ? Math.max(0, nextTier.min_xp - xp) : 0;
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
          <div className="absolute inset-0 bg-gradient-to-r from-[#030b26] via-[#100914]/88 to-[#24152e]/30" />
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

      <Link href="/dashboard/affiliate" className="hub-card block rounded-2xl p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Affiliate Program</p>
        <p className="mt-1 font-bold">Affiliate Program</p>
        <p className="text-sm text-zinc-400">Apply, share your disclosed link, and track who joins from it.</p>
      </Link>

      <div className="space-y-2">
        <p className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Messages & help
        </p>
        <AccountInboxLink />
        {HELP.filter((item) => item.href !== "/dashboard/messages").map((item) => (
          <Link key={item.href} href={item.href} className="hub-card flex items-center justify-between rounded-2xl px-4 py-3">
            <span className="flex items-center gap-2 font-medium">
              {item.href.includes("notifications") ? <Bell className="h-4 w-4" /> : <HelpCircle className="h-4 w-4" />}
              {item.label}
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
          <Link href="/dashboard/vip" className="hub-card flex items-center justify-between rounded-2xl px-4 py-3">
            <span className="flex items-center gap-2 font-semibold">
              <Gift className="h-4 w-4 text-[#f4c64e]" /> {tier.name}
            </span>
            <span className="text-sm text-muted-foreground">
              {nextTier ? `${xpToNext.toLocaleString()} XP to ${nextTier.name}` : "Top tier"}
            </span>
          </Link>
        ) : null}
        {PROGRESS.map((item) => (
          <Link key={item.href} href={item.href} className="hub-card flex items-center justify-between rounded-2xl px-4 py-3">
            <span className="flex items-center gap-2 font-medium">
              <item.icon className="h-4 w-4" /> {item.label}
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        ))}
        <Link href="/dashboard/referrals" className="hub-card block rounded-2xl border border-[#f4c64e]/40 p-4">
          <p className="flex items-center gap-2 font-bold"><Gift className="h-4 w-4 text-[#f4c64e]" /> Refer & earn</p>
          <p className="mt-1 text-sm font-semibold">Earn Freeplay when a friend qualifies</p>
          <p className="text-sm text-zinc-400">Your friend gets Freeplay after both of you qualify.</p>
        </Link>
      </div>

      <div className="space-y-2">
        <p className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rules & app</p>
        {RULES.filter((item) => !item.dot).map((item) => (
          <Link key={item.label} href={item.href} className="hub-card flex items-center justify-between rounded-2xl px-4 py-3">
            <span className="flex items-center gap-2 font-medium">
              <item.icon className="h-4 w-4" /> {item.label}
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        ))}
        <WhatsNewLink />
      </div>

      <Link href="/help#video-help" className="hub-card block rounded-2xl p-4">
        <p className="font-bold">Video help</p>
        <p className="text-sm text-zinc-400">Wallet, Freeplay, game-load, and cash-out guides.</p>
        <p className="mt-2 text-sm font-bold text-[#ff6b89]">Choose a guide · {6} videos</p>
      </Link>

      <details className="hub-card rounded-2xl px-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-3 [&::-webkit-details-marker]:hidden">
          <span>
            <span className="block font-bold">Preferences</span>
            <span className="text-sm text-zinc-400">Theme, text size, sound and play settings</span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </summary>
        <ProfilePreferences />
      </details>

      <Link href="/privacy" className="hub-card flex items-center justify-between rounded-2xl px-4 py-3">
        <span>
          <span className="block font-bold">Privacy & data</span>
          <span className="text-sm text-zinc-400">Balance privacy, public activity and data export</span>
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </Link>

      <SignOutButton />
    </MotionPage>
  );
}
