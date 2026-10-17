# Live production functionality report

Date: 17 October 2026

Production is deployed. `https://www.sweeptakehub.com` serves the new release and shows 12 active games.

## Deployment

| Item | Result |
| --- | --- |
| Vercel account | `spinoraoffical-8942` |
| Project | Existing `cashoutanytime` (`prj_ZF2oBLDLZVkBTQe3SyEokAdhffkz`) |
| Production deployment | `dpl_3ezvPvibXAji8EUw9g6XFKDqFEGJ` |
| Deployment URL | `https://cashoutanytime-3eew40j4h-spinoraoffical-8942s-projects.vercel.app` |
| Status | Ready. Created 17 October 2026, 01:56 Nepal time. Target: production. |
| Live aliases | `https://www.sweeptakehub.com`, `https://sweeptakehub.com`, `https://cashoutanytime-spinoraoffical-8942s-projects.vercel.app` |
| Git revision | `b6afbc6bee32b912e6c9d97aaa732ef47073c13c` plus the uncommitted restoration working tree. Nothing was committed or discarded. |
| Supabase project | `zecitlewsynyioemsqna`. The live homepage script contains that reference and does not contain `muetgtzcbecsqigtpfyn`. |
| Rollback | `dpl_bF58rpibALF2PS7bNK5RSWKf8Eab` (`https://cashoutanytime-9m05g55vw-spinoraoffical-8942s-projects.vercel.app`). It was not deleted. Promote that deployment to return the previous release. |

No hosted SQL was run. The old Supabase project was not contacted. No payment, payout, game load, or redemption was sent.

## Production checks

Checked in a browser on 17 October 2026.

| Check | Result |
| --- | --- |
| `https://www.sweeptakehub.com/play` | Heading “All games 12”. Visible cards: Fire Kirin, Juwa, Orion Stars, Game Vault, Vegas Sweeps, Milky Way, Panda Master, Cash Frenzy, VBlink, Mafia, Mr All In One, Cash Machine. |
| Inactive games | Ultra Panda, River Sweeps, Lucky Slots, High Stakes, Golden Dragon, Blue Dragon, Dragon Master, Ace Book, Galaxy Games, Moolah, VB Game, Mega Spin, Lucky Lion, Pharaoh's Treasure, Ocean King, Fish Hunter, Monster Hunter, and Buffalo Link are absent. Game Room is not a card. |
| `/games/gameroom` | 404, “This page could not be found.” |
| `/register` | “We'll email a confirmation link before you can play.” Also: “After Sign Up, open the confirmation link in your email.” The register script does not contain the old 6-digit sentence. |
| `/` | 200. Homepage contains the confirmation-link wording and the new Supabase project reference. |
| `/login` | 200. Email, password, Google, and forgot-password are shown. No login was submitted. |
| `/games` and `/games/fire-kirin` | 200. Fire Kirin is present. |
| Navigation | Play page links include Home, Play, Support, and Sign in. Footer links for games, company, and account are present. |
| Mobile | At 390×844, Play still shows “All games 12”, the menu button, and Home, Play, Support, and Sign in. |
| `/sitemap.xml` and `/robots.txt` | 200. |
| `/admin` | 307 to `/login?redirect=%2Fadmin`. Signed-out admin access is blocked. |
| Runtime logs | No error or warning records for this deployment in the 30 minutes after release. No request returned status 500 or above. |

## Pre-deploy gates

| Check | Result |
| --- | --- |
| Project | `cashoutanytime` only |
| `NEXT_PUBLIC_SUPABASE_URL` | Production and Preview. Belongs to `zecitlewsynyioemsqna`. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production and Preview. Token reference belongs to `zecitlewsynyioemsqna`. |
| `SUPABASE_SERVICE_ROLE_KEY` | Production and Preview. Secret preserved. Value not printed. |
| Old database settings | Absent from the production configuration. |
| Typecheck | `tsc --noEmit` exit 0 |
| Safety tests | Load outcome, stale-load hold, financial trust, payout security, deposit automation, staff access, and release-blocker checks passed. |
| Hosted build | Vercel build completed. Deployment reached Ready. |

## Feature results

### WORKING

1. Live domain serves `dpl_3ezvPvibXAji8EUw9g6XFKDqFEGJ`.
2. Play shows the 12 active games.
3. Inactive games, including Game Room, stay hidden.
4. Registration shows confirmation-link instructions.
5. Homepage, login, game list, Fire Kirin page, sitemap, and robots respond.
6. Mobile Play layout shows the 12 games and the bottom navigation.
7. Signed-out visitors are redirected away from admin.
8. The live site references Supabase project `zecitlewsynyioemsqna`.
9. Production logs show no errors or server failures for this deployment.

### PARTIALLY WORKING

1. Signup email delivery. The instructions are correct. An inbox was not opened.
2. Admin 2.0 after login. The signed-out gate works. A staff session was not opened.

### BROKEN

None confirmed.

### CONFIGURATION MISSING

1. Git author name and email. The release is deployed from the working tree and is not committed.
2. Hosted `fail_stale_game_loads` is still the stub that returns 0. The safe replacement was not installed.

### NOT TESTED

Signed-in login, logout, password reset, email delivery, player profile, wallet changes, transaction history, bonuses, referrals, support tickets, live chat, Admin 2.0 after login, game-management saves, CRM, stores, staff roles, KYC review, promotions, rewards claims, marketing sends, reports, settings saves, Paydora deposits, payouts, webhooks, and game-provider loads or redeems.

## Counts

WORKING: 9

PARTIALLY WORKING: 2

BROKEN: 0

CONFIGURATION MISSING: 2

NOT TESTED: 21

## Launch readiness

The public catalog and signup instructions are live on `https://www.sweeptakehub.com`. Payments and game transfers were not activated during this release. Rollback remains `dpl_bF58rpibALF2PS7bNK5RSWKf8Eab`.
