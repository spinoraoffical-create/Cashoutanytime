# Admin v2 Phase 2G report

Date: 14 October 2026. This phase restyles the existing verification, security, staff-role, and settings screens. It stays on `admin-v2-development`. Wallet math, payment routes, payout reservation, refunds, game providers, marketing senders, consent checks, authentication, staff permission definitions, SQL, migrations, and row security were not edited. Nothing was committed, pushed, merged, deployed, or written to the database.

## 1. Starting branch and commit

- Branch: `admin-v2-development`
- Starting commit: `55a9990` (`Admin v2 Phase 2F premium visual polish`)
- The branch was still `admin-v2-development` after the edits.
- `main` was not checked out. Production was not edited.
- `eng.traineddata` stayed untracked.

## 2. Relevant routes discovered

These routes already exist. No route was added or removed.

- `/admin/kyc` — Verification Center. Requires `kyc.manage`.
- `/admin/security` — Security Center overview. Super Admin only.
- `/admin/fraud` — Existing fraud flags. Super Admin only.
- `/admin/audit` — Existing audit log. Super Admin only.
- `/admin/roles` — Staff role and permission summary. Requires `users.roles`.
- `/admin/settings` — Site settings. Requires `settings.manage`.

Staff role assignment already lives on a player profile at `/admin/users/[id]`, inside the same panel as wallet actions. That file was left unchanged. There is no separate staff directory or staff-invite page.

Settings also links to payment methods, pages and FAQ, reviews, city pages, and the website hub. Those pages were left as they were. Payment methods was not opened for editing.

## 3. Files changed

- `src/app/admin/kyc/page.tsx`
- `src/app/admin/kyc/loading.tsx`
- `src/app/admin/security/page.tsx`
- `src/app/admin/security/loading.tsx`
- `src/app/admin/fraud/page.tsx`
- `src/app/admin/fraud/loading.tsx`
- `src/app/admin/audit/page.tsx`
- `src/app/admin/audit/loading.tsx`
- `src/app/admin/roles/page.tsx`
- `src/app/admin/roles/loading.tsx`
- `src/app/admin/settings/page.tsx`
- `src/app/admin/settings/loading.tsx`
- `src/components/admin/admin-kyc-review-card.tsx`
- `src/components/admin/admin-fraud-list.tsx`
- `src/components/admin/settings-editor.tsx`
- `src/components/admin/rewards-toggle.tsx`
- `src/components/admin/telegram-promo-messages.tsx`
- `src/components/admin/ui/admin-status-badge.tsx`
- `ADMIN_V2_PHASE2G_REPORT.md`

`admin-status-badge.tsx` only gained labels for `blocked` and `freeplay blocked`. Existing labels were not changed.

## 4. Visual improvements

- Verification, security, fraud, audit, staff roles, and settings use the same navy cards, purple borders, and page headers as the Phase 2F dashboard.
- Identity checks can be viewed as All, Pending review, Approved, or Rejected. That filter only hides rows already loaded. It does not run a new query.
- Approved and rejected checks use the shared status badge. Pending checks still show Approve and Reject.
- The photo viewer uses the navy card. The image address is still the one the existing review action already returned.
- Security Center is two links: Fraud flags and Audit log. No score or threat chart was added.
- Fraud rows use the navy card. Restore access stays purple. Block freeplay stays the destructive button. Both still ask for the existing confirmation.
- The audit table is read only, with the same columns and paging.
- Staff roles show each stored role, how many people have it, and the existing permission matrix. The matrix does not grant or remove a permission.
- Settings groups maintenance, registration, Telegram promo, welcome bonus, social links, and promo messages into the shared cards. Save buttons use the purple-to-blue admin color. Switches on this page use a purple on-state.
- Loading placeholders were added for these routes.

## 5. Existing features preserved

- Approve and Reject still call `updateKYCStatus`. They still do not ask for a second confirmation.
- The fraud search, restore, block-freeplay, and message link are the same actions.
- Audit paging and the stored columns are unchanged.
- The permission matrix still treats Super Admin as having every permission.
- Maintenance, registration, welcome bonus, and social links still save only when Save is pressed.
- The rewards switch and the Telegram promo switch still save immediately, as they did before.
- Send test now and delete promo message still use their existing confirmation.
- Add and edit promo message still use the existing form.

## 6. Permission boundaries reviewed

- `/admin/kyc` still calls `requirePermission("kyc.manage")`.
- `/admin/security`, `/admin/fraud`, and `/admin/audit` still call `requireSuperAdmin()`.
- `/admin/roles` still calls `requirePermission("users.roles")`.
- `/admin/settings` still calls `requirePermission("settings.manage")`.
- Navigation visibility in `src/lib/admin/nav.ts` was not edited.
- No role was created. No permission was granted. Store and sub-creator boundaries were not edited.
- The player-profile role checkboxes were not edited, because that component also contains wallet actions.

## 7. Tests passed

- `npx tsc --noEmit` — exit 0
- `node scripts/admin-nav-v2.test.mjs` — passed
- `node scripts/staff-access.test.mjs` — passed
- `node scripts/kyc-upload.test.mjs` — passed
- `npx next build` — exit 0

The first production build compiled, then failed while collecting page data because the local dashboard on port 3001 was using the same `.next` folder. The dashboard was stopped, the build was run alone, and it exited 0. Port 3001 was started again afterward. Port 3000 was not stopped.

There is no separate test script for the settings, fraud, audit, or roles pages. Those scripts were not invented.

## 8. Tests failed

None of the checks above failed on the final run. The first `npx next build` failed for the shared `.next` folder reason in section 7. It was not a type error in these pages.

The build still prints the existing image and hook warnings, including the identity photo preview, which already used a plain image tag so the stored photo address is unchanged.

## 9. Browser testing status

A signed-in Super Admin session was already open at `http://localhost:3001`. Authentication was not bypassed. No approve, reject, save, restore, block, send, or delete was clicked. No identity photo was opened.

- Desktop verification page showed the navy card, the purple All filter, and the stored checks.
- Desktop security page showed Fraud flags and Audit log.
- Desktop staff roles showed the stored roles and the permission summary.
- Desktop and 390-wide settings showed the rewards card, the settings description, and the purple scrollbar. The phone layout stacked the card and kept the menu button.
- Fraud flags loaded the empty state: no flagged players in that view.

## 10. Remaining issues

- Payment methods, pages and FAQ, reviews, and city pages still use their earlier layout.
- The role checkboxes on a player profile were already on the shared card and were not redrawn.
- There is no staff directory beyond the role counts and the player-profile role form.
- The identity photo preview still uses a plain image tag. Replacing it would not change who can see the photo, so it was left as it was.
- The reference image from earlier phases was still not available, so this is a match to the Phase 2F admin style, not a pixel match to an image file.

## 11. Any security concerns discovered

- The identity photo is still shown only after `kyc.manage` has already allowed the page. Signed URL generation, storage, and the private bucket were not changed. The photo address is not written to the audit text by this restyle.
- The fraud list still shows the email, phone, and IP values the existing query already returned to a Super Admin.
- Settings still does not print API keys, provider passwords, or bot tokens.
- The rewards switch and Telegram promo switch still save as soon as they are changed. That is the previous behavior. The page now says so.
- No new security score, audit row, or threat statistic was added.

## 12. Recommendations for Phase 2H

- Restyle payment methods only as presentation, and keep every payment action on its current confirmation.
- Restyle the pages-and-FAQ, reviews, and city-page editors with the same cards, without changing what they save.
- Leave the player-profile wallet actions untouched if that screen is opened again.
- Compare the live admin screens with the reference image before any production deploy.

## 13. Final safety check

- Branch is still `admin-v2-development`.
- No financial files were changed.
- No migration files were changed.
- No permission logic was changed. The pages still call the same permission gates.
- No environment files were changed.
- No unrelated files were changed. `eng.traineddata` remains untracked.
- No Git push occurred in this phase.
- No deployment occurred.
- Nothing was committed.
