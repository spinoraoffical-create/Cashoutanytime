# Marketing feature matrix

| Feature | State |
| --- | --- |
| Marketing dashboard counts | Working when the database read succeeds. Not browser-tested. |
| Create email draft | Uses the existing saver. Not sent during tests. |
| Schedule email | Code path exists. The cron is scheduled. It cannot run until `CRON_SECRET` is set. NOT TESTED against Resend. |
| Provider-accepted vs delivered | Accepted is counted. Delivered is Not tracked. |
| SMS bulk campaign | Not a separate working composer. One-time offers can text only opted-in numbers when Twilio is configured. Twilio names are missing on Vercel. |
| SMS STOP | Code exists. NOT TESTED with a live Twilio webhook. |
| Telegram promo | Existing page. Promo chat is not separately configured, so it can share the admin alert chat. Not posted during this work. |
| Offers | Existing page kept. Wallet math not changed. NOT RE-TESTED with a live send. |
| AI blog | Existing draft-first page. Auto-blog cron left unscheduled. |
| Clicks, conversions, revenue | Not tracked. |
| Store isolation for offers | Existing offer scope remains. Network counts on the new dashboard require `newsletters.manage`. |
