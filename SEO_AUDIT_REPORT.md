# Sweepstakes Hub SEO audit

Date: 17 October 2026  
Site checked: https://www.sweeptakehub.com  
No code, database, payment, or game-provider changes were made for this audit.

## 1. Executive summary

The site is already partly ready for Google. The homepage is indexed. The preferred address is `https://www.sweeptakehub.com`. The sitemap loads, and `robots.txt` points at it. Zero clicks and zero impressions do not mean the site is broken. A new site can be indexed and still have no search traffic yet.

The main technical problem is not “Google cannot see the site.” It is that some public URLs are confusing:

- `/games` is not a real games page. The server returns HTTP 200, then the page immediately redirects to `/play`. Its canonical tag points at the homepage, not at `/play`.
- `/play` is the real public game list. It returns HTTP 200, can be indexed, and names games in the HTML.
- The sitemap lists 185 URLs, including login, registration, `/games`, a large set of city pages, and 86 blog URLs. Google’s earlier “150 discovered” number is not 150 indexed pages.
- Many pages inherit the homepage Open Graph title and image even when their own title is different.
- The sitemap date is refreshed every time the file is generated, even when the page did not change.

No rankings, traffic, or first-page placement are promised.

## 2. Current verified Google status

These points come from the owner’s Search Console notes, not from a Search Console login.

| Item | Owner’s status | What it means |
| --- | --- | --- |
| Homepage | Indexed | Google has accepted the homepage. |
| `/games` | Discovered — currently not indexed | Google knows the URL. It has not chosen to list it. |
| Live test of `/games` | Available to Google; can be indexed | The URL is not blocked. |
| Indexing request | Already submitted | Do not submit the same unchanged URL again. |
| Sitemap | Processed successfully | Google could read the file. |
| Discovered URLs | 150 at the time of the report | Discovered is not the same as indexed. |
| Clicks and impressions | 0 and 0 | No measured search visits yet. Not a ranking. |
| Page indexing report | Still processing | Google has not finished classifying every URL. |

The live sitemap on 17 October 2026 contains **185** URLs. That is newer than the 150 Google had already discovered. It does not mean 185 pages are indexed.

## 3. Route inventory

| Class | Routes |
| --- | --- |
| PUBLIC_INDEXABLE | `/`, `/play`, `/faq`, `/help`, `/blog`, `/blog/[slug]`, `/promotions`, `/leaderboard`, `/vip`, `/about`, `/support`, `/contact`, `/terms`, `/privacy`, `/spin`, `/games/[slug]` for active games, `/[state]` and `/[state]/[city]` geo pages, `/whats-new`, `/get-app` |
| PUBLIC_NOINDEX | Should be: `/login`, `/register`, `/reset-password`, `/reset-password/update`, `/restricted`, `/unsubscribe/[userId]/[token]`. Today, login and register are still marked indexable and are in the sitemap. `/restricted` is blocked in `robots.txt` but does not set `noindex`. |
| PRIVATE_AUTHENTICATED | `/dashboard` and its wallet, deposit, withdraw, games, verification, messages, rewards, and related pages. The dashboard layout sets `noindex`. |
| ADMIN_PRIVATE | `/admin` and every admin screen. The admin layout sets `noindex`. |
| API_ENDPOINT | `/api/*`, `/auth/callback`, `/feed.xml`, `/llms.txt`, `/llms-full.txt` |
| REDIRECT | `/games` redirects to `/play` inside the app. `/r/[code]` redirects to `/register`. `/home` redirects to `/`. Several old account paths redirect into `/dashboard`. `http://` and the non-www host redirect to `https://www.sweeptakehub.com`. |
| ERROR_PAGE | Missing game pages call `notFound()` and set `noindex`. |

Private pages stay private through login checks. `noindex` and `robots.txt` are extra signals. They are not the security control.

## 4. Sitemap audit

Live file: https://www.sweeptakehub.com/sitemap.xml  
Status: HTTP 200  
Count on 17 October 2026: **185**

| Group | Count | Keep? |
| --- | --- | --- |
| Blog posts | 86 | Only after a quality review. Several titles make legal or payout claims that were not verified in this audit. |
| City and state pages | about 70 | Only if each page has distinct useful content. A large set of similar city URLs can look thin. |
| Game pages | 9 | Keep active public game pages. Do not add inactive games. The public catalog currently shows 12 active games, so the sitemap and the catalog do not match. |
| Core public pages | homepage, play, FAQ, help, promotions, VIP, about, support, contact, terms, privacy, spin, leaderboard | Keep. |
| `/games` | 1 | Remove from the sitemap after `/play` is the canonical games URL. It is a redirect, not a separate page. |
| `/login` and `/register` | 2 | Remove. These are account doors, not search content. |

The generator sets `lastModified` to the current time for most URLs. That makes every URL look newly edited whenever the sitemap is rebuilt. Blog posts are the exception: they use `published_at` when that date exists.

The sitemap does not list admin, dashboard, wallet, or payment URLs. It does not print player balances or secrets.

## 5. Indexing findings for `/games`

Checked live, without signing in:

| Check | Result |
| --- | --- |
| HTTP status | 200 |
| Authentication required | No |
| `robots` meta | `index, follow` |
| Canonical | `https://www.sweeptakehub.com` (the homepage, not this URL) |
| Real page behavior | The HTML contains an internal redirect to `/play` |
| Useful games content | The useful list is on `/play`, which also returns 200 |
| `/play` canonical | `https://www.sweeptakehub.com/play` |
| `/play` in the sitemap | Yes |
| Homepage links toward games | Yes, toward `/play` and individual `/games/[slug]` pages |

Google can fetch `/games`. The page is not blocked. It is also not a distinct article or directory: it points Google at the homepage through the canonical tag and then sends the visitor to `/play`. That is a reasonable reason for “Discovered — currently not indexed.” It is not proof that the whole site has a technical failure.

`/play` is the page that should be indexed for the game list. If Google still leaves `/play` out after it has recrawled the corrected sitemap, that can simply be time. Do not submit the same URL again while nothing has changed.

## 6. Metadata findings

The root layout applies the homepage title, description, Open Graph tags, Twitter card, and `index, follow` to the whole site. Child pages replace the document title, but many do not replace the social tags.

Live `/play` example:

- Title: `Play | Sweepstakes Hub` (correct and unique)
- Description: `Browse Game Rooms. Load credits and redeem winnings from one account.`
- Canonical: `https://www.sweeptakehub.com/play` (correct)
- Open Graph title and URL: still the homepage

Homepage title in use: `Sweepstakes Hub | Juwa Casino, Slot Games & Fish Games`.

About metadata says the platform is “trusted by thousands.” That number was not verified. It should not stay unless the owner can support it.

The share image is `/logo.webp` on a 1200×630 slot. A logo is a weak share image. A real 1200×630 image can wait for a design choice.

## 7. Canonical findings

| Address | Result |
| --- | --- |
| `https://www.sweeptakehub.com/` | 200. This is the preferred host. |
| `https://sweeptakehub.com/` | 308 to `https://www.sweeptakehub.com/` |
| `http://www.sweeptakehub.com/` | 308 to `https://www.sweeptakehub.com/` |
| `http://sweeptakehub.com/` | 308 to `https://sweeptakehub.com/`, which then goes to the www HTTPS host |

There is no redirect loop. DNS and Vercel domain settings were not changed.

The mismatch is `/games`: visitors end on `/play`, while the canonical tag says the homepage.

## 8. Robots.txt findings

https://www.sweeptakehub.com/robots.txt returns the sitemap `https://www.sweeptakehub.com/sitemap.xml` and host `www.sweeptakehub.com`.

It allows the public site and disallows `/dashboard`, `/admin`, `/chat`, `/api/`, `/auth/`, `/unsubscribe`, and `/restricted`.

Important public pages are not blocked. Login and registration are not blocked, which is correct if they are given `noindex`, because Google must be allowed to read that tag. They should not stay in the sitemap.

`robots.txt` does not protect private data. Login and database rules do that.

## 9. Internal linking findings

Public navigation already connects the homepage, `/play`, individual game pages, blog, FAQ, promotions, and support. Game pages link back toward play. The footer and legal pages exist for terms, privacy, and contact.

Gaps:

- `/games` is a dead-end name in the sitemap even though the visible links use `/play`.
- The sitewide game list in structured data names 8 games. The live lobby shows 12 active games. Fire Kirin, Orion Stars, Milky Way, Panda Master, and VBlink are in the lobby but missing from that list.
- There is no dedicated public responsible-play page. `/responsible` redirects to a signed-in dashboard page, so it should not be used as a public SEO link.

## 10. Blog quality findings

Articles are stored as blog posts and also have a large built-in fallback list. If the database query returns nothing, the site publishes that fallback list instead. The sitemap currently exposes 86 blog URLs.

The generator can mark a post `published` immediately when auto-publish is on. There is no required review step in the publishing path. Some fallback titles discuss legality, “available nationwide,” payment methods, and whether the site is legitimate. Those claims were not checked against the live rules.

No new articles were generated for this audit. Publishing volume should not be increased. A safe workflow is: draft, review required, approved, then published.

## 11. Mobile performance findings

No Lighthouse score was measured, so no speed improvement is claimed.

Visible risks:

- The game catalog is a client component and loads animation code.
- The homepage is rendered dynamically on each request.
- The same homepage social image and schema block are added on every page.
- Fonts are preloaded, which is good.
- Images are allowed to use modern formats in the Next.js config.

A before-and-after measurement is required before any speed work is called an improvement.

## 12. Security findings

The sitemap and public metadata do not expose balances, payment records, or provider secrets. Admin and dashboard layouts set `noindex`. Those areas still depend on authentication, which was not changed.

Structured data does include a placeholder WhatsApp link, `https://wa.me/1234567890`, and older Spinora social profile URLs. Those are public marketing links, not secrets, but they are not accurate Sweepstakes Hub identities.

## 13. Changes made

None. This pass was investigation only.

## 14. Files modified

None in the application. This report and `SEO_30_DAY_ACTION_PLAN.md` were added.

## 15. Tests performed

- Live HTTP checks for the homepage, both domain forms, `/games`, `/play`, `robots.txt`, and `sitemap.xml`
- Read of the sitemap URL groups
- Read of titles, descriptions, canonical tags, and robots tags in the live HTML
- Code review of metadata, sitemap, robots, redirects, blog publishing, and schema

## 16. Tests passed

- Preferred domain redirects to `https://www.sweeptakehub.com` without a loop
- Homepage, `/play`, sitemap, and robots return HTTP 200
- `/play` has its own title and a self canonical
- Admin and dashboard code set `noindex`
- Sitemap does not list admin or wallet URLs

## 17. Tests failed

No production build, TypeScript, or lint run was started, because no application code changed.

These live checks did not meet the intended SEO result:

- `/games` is indexable HTML whose canonical is the homepage, while the page redirects to `/play`
- Open Graph on `/play` still describes the homepage
- Sitemap includes login, registration, and the redirect URL
- Sitemap `lastModified` is the generation time for most URLs

## 18. Remaining risks

- Google may keep `/games` out of the index until the canonical and sitemap agree.
- Thin or repetitive city and blog URLs can dilute the site even after the technical fixes.
- Unverified claims in titles and articles can create trust problems.
- Search Console’s indexing report is still processing, so counts will move without a code change.

## 19. Recommended next steps

1. Make `/play` the only games-directory URL in the sitemap, with a matching canonical.
2. Stop listing login and registration.
3. Give each important public page its own social title and description.
4. Stop refreshing `lastModified` unless the page actually changed.
5. Review blog and city pages before adding more of them.
6. Remove the placeholder WhatsApp number and old Spinora profiles from public schema after the owner confirms the real profiles.
7. Measure mobile speed before changing layout code.

## 20. Items requiring owner approval

- Editing public metadata, sitemap, and canonical behavior
- Removing login, registration, and `/games` from the sitemap
- Reviewing or unpublishing weak blog and city pages
- Replacing social profile links
- Any production deploy

Financial systems, game-provider APIs, authentication, permissions, and production database records were not changed.
