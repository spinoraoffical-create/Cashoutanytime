# Automation runbook

Use this when something on Automation looks wrong. The page does not fix it for you.

## What the page is telling you

| Label | Meaning | What to do |
|---|---|---|
| Switch off | The saved setting is off. | Leave it off unless you want that job. Turning it on does not put it on the Vercel timer. |
| Not on the Vercel schedule | The route exists. `vercel.json` does not call it. | Expect it to sit still. Add it to the schedule only after you accept that it can publish or send. |
| Last run is not stored | The daily search job is scheduled, and this app does not save whether 08:00 UTC succeeded. | Check the Vercel cron log for `/api/cron/seo-index`. A missing log line means it did not run. |
| Last run is late | A saved timestamp is older than 1.5 times the expected gap. | Confirm the caller (Vercel or the outside cron) is still hitting the route. |
| Present / Missing | That environment variable has a value, or it does not. | Missing Resend means email campaigns fail. Missing Paydora webhook secret means deposits cannot be confirmed. |

“Today's operational snapshot” is the counts at the moment you open the page. It is not an email.

## Safe recovery (no money)

1. Search indexing: read the Vercel log for the 08:00 UTC run. If you must run it once, call `GET /api/cron/seo-index` with `Authorization: Bearer <CRON_SECRET>` from a trusted machine. That notifies search engines. It does not pay anyone.
2. AI blog and Telegram: do not “recover” them by calling the cron URL. A call can publish a post or send Telegram. Use the existing AI blog or autopilot screen when a person wants that send, and leave `?force=true` unused unless you mean to ignore the wait time.
3. A newsletter stuck in `sending`: open Email marketing and read the recipient error. If the error is `RESEND_API_KEY is not configured in env.`, add the key on the host, then create a new send only for people you still intend to email. Do not flip the failed “First deposit reminder” back to pending unless that email should go out.
4. Consent: if a person opted out, leave their row skipped. The sender checks `email_promotions` and SMS opt-out at send time.

## Money that needs a person

Do these by hand. Do not add an automatic retry.

1. Cash out shows under “Cash outs needing a person.” Open the payout in admin and in Paydora. Match the existing payout id.
2. If Paydora says paid, record that. Do not send the payout again.
3. If Paydora says failed and the wallet reservation is still held, release or complete it through the existing payout screens after you are sure Paydora did not pay.
4. If Paydora’s status is missing or unclear, stop. Reconcile that id. An unknown status is not a reason to pay again.
5. A deposit webhook that failed: find the Paydora `depositId` in `payment_intents`. If `paydora_processed_events` already has that payment id, the wallet was credited. Do not credit it again. If it was never credited and Paydora shows paid, the normal webhook retry can finish the original credit. Do not invent a second payment id.
6. A refund webhook must not be replayed into a second reversal. Confirm the ledger row for that deposit id first.

## Alerts

Critical items appear in the amber box on `/admin/automation` for Super Admin, admin, and manager. There is no pager and no Telegram alert from this page. Someone has to open it.

Failed webhook rows are also on the Super Admin dashboard as “Failed webhooks.”

## Provider availability

The provider list is a configuration check. It does not prove Paydora, Resend, Twilio, or Telegram are up. If a key is Missing, that channel cannot work until the variable is set on the host. Do not paste the key into chat or into a file in git.
