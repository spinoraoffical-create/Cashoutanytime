# Sweepstakes Hub — Premium Gaming Support Platform

A production-ready gaming portal built with Next.js 15, TypeScript, Tailwind CSS, ShadCN UI, Supabase, and Framer Motion.

## Features

- **SEO Optimized** — Metadata API, sitemap, robots.txt, JSON-LD structured data
- **Authentication** — Supabase Auth (email OTP; optional phone identifier)
- **Game loads** — Wallet load / redeem via agent APIs (Juwa, Vegas, Game Vault, and others)
- **Payments** — Paydora deposits and payouts
- **Live Chat** — Real-time messaging via Supabase Realtime
- **VIP / referrals** — Tiers, unique links, reward tracking
- **Admin Dashboard** — Users, KYC, requests, analytics, Telegram

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Environment

Copy `.env.example` to `.env.local` and fill every value you use. **Do not commit secrets.**

Game-automation credentials were removed from source. Set `JUWA_*`, `VEGAS_*`, `GAMEVAULT_*`, and the other `*_AGENT_*` / `*_SECRET_*` vars for each game you enable, then **rotate those keys** if they ever lived in git.

### 3. Set up Supabase

See [supabase/README.md](supabase/README.md). Apply `supabase/migrations/` in timestamp order, then `supabase/paydora-security-hardening.sql` if the Paydora RPCs are not already on the project.

Create an admin user after first signup:

```sql
UPDATE profiles SET role = 'admin' WHERE email = 'your@email.com';
```

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
src/
├── app/                  # Next.js App Router
│   ├── (auth)/           # Login / register
│   ├── dashboard/        # Member dashboard
│   ├── admin/            # Staff panel
│   └── api/              # Route handlers (Paydora, cron, chat)
├── components/           # UI
├── lib/                  # Supabase, payments, game automation, actions
└── types/
supabase/
├── migrations/           # Authoritative schema (apply in order)
├── paydora-security-hardening.sql
└── archive/              # Legacy combined dumps (reference only)
scripts/                  # Setup + optional dev-only helpers
public/
├── logo.webp             # Brand logo
└── games/                # Game images
```

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4
- **UI:** ShadCN UI (Radix primitives)
- **Backend:** Supabase (Auth, Database, Realtime)
- **Payments:** Paydora
- **Animation:** Framer Motion

## Brand IDs left unchanged (would break auth/assets/live site)

- Phone-auth emails: `@phone.spinora.local`
- Device fingerprint cookie/storage: `spinora_did` / `spinora_device_id`
- Production hostname / email domain: `spinoracasinos.com`
- Promo image paths: `/images/promos/spinora_*.jpg`
- Chat sender env: `SPINORA_BOT_SENDER_ID`
- Setup script path: `supabase/archive/SPINORA-COMPLETE-SCHEMA.sql` (generated artifact name)
- Import path: `src/lib/admin/spinora-profile.ts`
- Historical blog slugs containing `spinora`
- Social handles that still live on Instagram/TikTok (`spinora09`)

## License

Private — All rights reserved.
