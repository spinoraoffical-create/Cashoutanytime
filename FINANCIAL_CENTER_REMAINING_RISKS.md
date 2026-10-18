# Financial Center remaining risks

Date: 18 October 2026. Overall rating is 5/10. A 10/10 is not earned while the $5 is unreconciled, provider outcomes are unverified, and database concurrency tests were not run.

| Area | Rating | Why |
| --- | --- | --- |
| Wallet integrity | 7 | Trigger still blocks unclaimed balance writes. The $5 debit has no refund row. |
| Deposits | 6 | Missing-currency credit is live. Proof and note labeling are local only. |
| Game loads | 5 | Wording is fixed locally. The stored $5 error still claims a refund. Provider HTTP was not retested. |
| Redeems | 5 | Display rules exist. No live redeem was run. |
| Refunds | 4 | The function can run as service role. The eligible $5 was not refunded, by design, pending your approval. |
| Cash outs | 5 | Reservation rules are unit-tested. No live cash-out was submitted. |
| Payouts | 5 | Paid is a stored status. Callback verification was not live-tested. |
| Reconciliation | 6 | Alerts are evidence-based and capped. They are not deployed and were not opened in a browser. |
| Transaction tracing | 6 | Explorer reads real rows. It is not a full joined timeline and has no staff-action history. |
| Admin usability | 6 | Navigation and investigation copy are in the branch. Mobile and desktop were not clicked. |
| Security | 7 | Refund execute stays service-role only. Preview shares production data, so it was not deployed. |
| Overall | 5 | Critical $5 gap, missing Postgres and browser tests, and no safe preview. |

## Blockers

1. Do not refund the $5 until you approve that one `refund_game_load_wallet` call. Do not edit the balance by hand.
2. Do not deploy a Preview of project `cashoutanytime` while Preview uses the production database and live game credentials.
3. Do not deploy production until you approve it after reading this pack. Postgres concurrency and Playwright are NOT TESTED.
4. Held cash outs still lack reviewer and audit-history detail.
5. Reconciliation can false-alert on identical descriptions or same-amount refunds, and it only scans recent capped rows.
