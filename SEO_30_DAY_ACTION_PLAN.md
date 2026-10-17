# Sweepstakes Hub — 30-day SEO plan

This plan does not promise rankings, traffic, or customers. Success means cleaner pages, accurate Search Console data, and content that matches the real site.

No application change in this plan should be deployed until the owner approves it. Payments, wallets, game transfers, and account security stay untouched.

## Week 1 — Technical SEO and indexing readiness

### Make the games URL unambiguous

- Priority: High
- Benefit: Google gets one games page instead of a redirect that claims to be the homepage.
- Effort: Small
- Depends on: Owner approval to edit `/games`, `/play`, and the sitemap
- Measure: `/play` canonical stays `https://www.sweeptakehub.com/play`. `/games` is either a real 301/308 to `/play` or no longer in the sitemap. Search Console no longer treats `/games` as a separate indexable page.

### Clean the sitemap

- Priority: High
- Benefit: Google spends crawl attention on public pages.
- Effort: Small
- Depends on: The URL inventory in `SEO_AUDIT_REPORT.md`
- Measure: Sitemap no longer contains `/login`, `/register`, or redirect URLs. `lastModified` changes only when a page changes.

### Fix social tags that copy the homepage

- Priority: Medium
- Benefit: Shared links and Google see the page people actually opened.
- Effort: Small
- Depends on: Existing Next.js metadata helpers
- Measure: `/play`, FAQ, about, contact, and game pages each show their own Open Graph title and URL.

### Confirm the domain once

- Priority: Low
- Benefit: The preferred host is already correct.
- Effort: None unless a later check fails
- Depends on: Current Vercel redirects
- Measure: `http://` and non-www addresses still land on `https://www.sweeptakehub.com` in one or two hops, with no loop.

## Week 2 — High-quality public content

### Review the 86 blog URLs before adding any

- Priority: High
- Benefit: Search results describe the real service instead of unverified legal or payout claims.
- Effort: Medium
- Depends on: A person checking each article against the live terms, FAQ, and payment pages
- Measure: Only articles in an approved state remain public. New auto-publish stays off. No new article batch is generated just to add URLs.

Use these states: draft, review required, approved, published.

### Give `/play` a clear public explanation

- Priority: High
- Benefit: The games directory tells visitors what Sweepstakes Hub is, which games are on, and where the rules and help pages are.
- Effort: Small
- Depends on: The 12 games that are actually active
- Measure: The server-rendered HTML contains one H1, the active game names, and links to those game pages. No prize or payout promise is added.

### Match game pages to active games

- Priority: Medium
- Benefit: Each public game page is unique and real.
- Effort: Medium
- Depends on: Existing game descriptions. Do not invent features.
- Measure: Sitemap game count matches the active public catalog. Inactive games stay out.

## Week 3 — Internal linking, performance, and trust

### Connect the public pages with normal sentences

- Priority: Medium
- Benefit: Visitors and Google can move from the homepage to games, rules, FAQ, contact, and eligibility without hitting a private page.
- Effort: Small
- Depends on: Existing `/faq`, `/terms`, `/privacy`, `/contact`, and `/play`
- Measure: Those links work without login. No admin or wallet URL is added to public navigation.

### Replace inaccurate public identity data

- Priority: Medium
- Benefit: Schema and social links belong to Sweepstakes Hub.
- Effort: Small
- Depends on: The owner confirming the real Telegram, Facebook, Instagram, TikTok, and WhatsApp profiles
- Measure: The placeholder `wa.me/1234567890` number and old Spinora profile URLs are gone from public schema.

### Measure mobile speed before editing the design

- Priority: Medium
- Benefit: Avoids a visual change that does not make the site faster.
- Effort: Small to measure, unknown to fix
- Depends on: A Lighthouse mobile run of the homepage and `/play`
- Measure: Record Largest Contentful Paint, Interaction to Next Paint, and Cumulative Layout Shift before any change. Change code only if a specific heavy part is identified. Record the same three numbers again.

## Week 4 — Search Console analysis

### Read the indexing report after Google finishes processing

- Priority: High
- Benefit: Decisions use Google’s own classification instead of guesses.
- Effort: Small
- Depends on: The owner opening Search Console. This project cannot see that account.
- Measure: Record indexed count, excluded count, and the reason for each important excluded URL.

How the owner checks this:

1. Open Google Search Console for `https://www.sweeptakehub.com`.
2. Pages report: indexed pages and excluded pages, including the reason.
3. Sitemaps report: submitted URL count and status. Discovered is not indexed.
4. Performance report: set the date range to 28 days. Read clicks, impressions, queries, and average position. Zero means no measured search visits, not a ranking score.
5. URL Inspection: use it for a page only after that page’s canonical or content actually changed.

### Decide the next content edit from queries, not from a target ranking

- Priority: Medium
- Benefit: Later pages answer searches people already use.
- Effort: Small once data exists
- Depends on: At least a few impressions. If the report is still empty, wait rather than inventing topics.
- Measure: A short list of real queries, each tied to an existing page or to a reviewed new article. No traffic target is set.

## What will not be done in these 30 days

- No change to deposits, withdrawals, balances, payment providers, or game recharge and redeem.
- No new Supabase project and no use of the old Spinora project.
- No mass article generation.
- No repeated indexing requests for pages that did not change.
- No claim that the site will reach page one.
