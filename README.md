# Spinora — Premium Gaming Support Platform

A production-ready gaming portal built with Next.js 15, TypeScript, Tailwind CSS, ShadCN UI, Supabase, and Framer Motion.

## Features

- **SEO Optimized** — Metadata API, sitemap, robots.txt, JSON-LD structured data
- **Authentication** — Supabase Auth (login, register, password reset)
- **Game Requests** — Request and track game accounts with admin management
- **Live Chat** — Real-time messaging via Supabase Realtime
- **VIP System** — Bronze → Platinum tiers with progress tracking
- **Referral Program** — Unique referral links and reward tracking
- **Admin Dashboard** — User management, chat, requests, analytics
- **Premium UI** — Dark theme, glassmorphism, Framer Motion animations

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run the SQL in `supabase/schema.sql` in the SQL Editor
3. Copy `.env.example` to `.env.local` and fill in your credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 3. Create an admin user

After registering, update your profile role in Supabase:

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
├── app/                  # Next.js App Router pages
│   ├── (auth)/           # Login, register, reset password
│   ├── dashboard/        # User dashboard (protected)
│   ├── admin/            # Admin panel (role-protected)
│   ├── promotions/       # SEO public pages
│   ├── vip/
│   ├── about/
│   └── support/
├── components/           # Reusable UI components
├── lib/                  # Utilities, Supabase, actions, SEO
└── types/                # TypeScript types
supabase/
└── schema.sql            # Database schema + RLS policies
public/
├── logo.jpeg             # Spinora brand logo
└── games/                # Game platform images
```

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4
- **UI:** ShadCN UI (Radix primitives)
- **Backend:** Supabase (Auth, Database, Realtime)
- **Animation:** Framer Motion

## SEO

- Unique metadata per page (title, description, keywords, OG, Twitter)
- Auto-generated `/sitemap.xml`
- `/robots.txt` blocking `/dashboard`, `/admin`, `/chat`
- JSON-LD: Organization, Website, Breadcrumbs
- SSR/SSG for all public pages

## License

Private — All rights reserved.
