# Authentication functionality report

Date: 17 October 2026

The 6-digit signup and password recovery flow is on Production. A disposable inbox test on the live site passed. Production was not left on the earlier confirmation-link release.

## Release

| Item | Value |
| --- | --- |
| Project | `cashoutanytime` |
| Live URL | `https://www.sweeptakehub.com` |
| Current deployment | `dpl_58Da2u81ovHBncLnj9MfVorL9QSm` |
| Deployment URL | `https://cashoutanytime-7n8x2u2bl-spinoraoffical-8942s-projects.vercel.app` |
| Previous production | `dpl_3ezvPvibXAji8EUw9g6XFKDqFEGJ` |
| Rollback | `npx vercel rollback dpl_3ezvPvibXAji8EUw9g6XFKDqFEGJ --yes` |

That rollback deployment was still Ready before this release. It restores the confirmation-link register page. Supabase project `zecitlewsynyioemsqna` is unchanged by a rollback.

A first production upload, `dpl_4tiXLTRP1qDyKKn71zDzVhwoknBW`, passed the inbox test. A signed-out visit to `/reset-password/update` showed the new-password form because the page treated an empty session as signed in. Saving that form cannot change a password without a recovery session. The page was corrected and released as `dpl_58Da2u81ovHBncLnj9MfVorL9QSm`. A signed-out visit now says the code expired and offers a new code.

## Checks before release

| Check | Result |
| --- | --- |
| Production and Preview Supabase URL and anon key | Both use project `zecitlewsynyioemsqna`. The old project string is absent from the live site. |
| Service role | Same Production and Preview entry. The value was not printed. |
| Auth source | Signup uses `verifyOtp` type `signup`. Recovery uses type `recovery`. The confirmation link callback remains. |
| Typecheck | PASS |
| Lint | PASS. Existing image and hook warnings only. |
| Production build | PASS |
| Auth regression test | PASS. `scripts/auth-email-code.test.mjs` |
| Email templates | Still installed. Confirm signup and Reset password match the tested short templates, including `{{ .Token }}` and `{{ .ConfirmationURL }}`. SMTP was not changed. |
| Super Admin | 1 assignment before and after the test. |
| Paydora and game transfers | Not called. Their settings were not changed. No wallet, payout, or financial SQL was run. |

## Live pages

| Page | Result |
| --- | --- |
| `/register` | Asks for a 6-digit code before play. Password rules and show/hide are present. The old confirmation-link sentence is gone. |
| `/login` | Email, password, show/hide, Google, and Forgot password. A code is not required on the form. |
| `/reset-password` | Email field and Send code. |
| `/reset-password/update` without a session | “Code expired”, with a link to request a new code. |
| `/admin` while signed out | Redirects to `/login?redirect=%2Fadmin`. |

## Production inbox test

One new disposable account was used. The account had no wallet balance and was deleted afterward. Codes and passwords are not recorded.

| Step | Result |
| --- | --- |
| Signup email | PASS. Subject “Your sweeptakehub.com code”. One 6-digit code and a confirmation link. |
| Wrong signup code | PASS, rejected |
| Correct signup code | PASS |
| Login and logout | PASS |
| Recovery email | PASS. Subject “Reset your sweeptakehub.com password”. One 6-digit code and a reset link. |
| Wrong recovery code | PASS, rejected |
| Correct recovery code, password update, login with the new password | PASS |

## Still not tested

- Opening the confirmation or recovery link in a browser.
- Resend after the 60-second wait.
- An expired code.
- Admin or Super Admin sign-in. No staff password was used.
- A mobile browser pass of the new screens.
