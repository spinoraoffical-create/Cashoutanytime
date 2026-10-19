# Automation status

| Job | Schedule | Will this deploy send anything? |
| --- | --- | --- |
| Email campaign sender | Every 15 minutes | No. There are no campaign rows, and `CRON_SECRET` is not on Vercel, so the route stays closed. |
| Search indexing | Daily 08:00 UTC | Already scheduled before this work. It does not send marketing. |
| Telegram promo | Not scheduled | No |
| Telegram auto-post | Not scheduled | No |
| AI blog | Not scheduled | No |

Last successful run is Not tracked. There is no job-log table.

Do not turn the unscheduled jobs on until each one has its own review. Enabling them from this deploy would be able to post or publish without a new confirmation.
