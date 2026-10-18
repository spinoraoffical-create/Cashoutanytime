# Updated launch blockers

Date: 17 October 2026

Production is still deployment `dpl_2bxo4UhEGxQQcoVJty7JgC1XmDzT`. Local fixes are not on that deployment.

| Issue | Status | Why |
| --- | --- | --- |
| Deposit, load, redeem, and payout switches | VERIFIED IN TEST | Off unless the value is exactly `on`. Not deployed. |
| Held Paydora callback is saved and not credited | VERIFIED IN TEST | Signature is checked first. A processed row is not rewritten. |
| Age 18 on the server | VERIFIED IN TEST | Missing, invalid, future, under-18, and leap-day cases. Not deployed. |
| Money location check | VERIFIED IN TEST | Missing platform evidence fails closed. Public pages stay open. |
| Critical Next.js advisory in this copy | VERIFIED IN TEST | Next.js 15.5.28. Production is still 15.5.19. |
| Duplicate payment fixture | VERIFIED IN TEST | Second credit does not raise the fixture balance. |
| Concurrent payout fixture | VERIFIED IN TEST | Twelve requests debit once. |
| Unknown game load is not refunded | VERIFIED IN TEST | Timeout stays unknown. Live SQL is not updated. |
| Identity approval on the live database | BLOCKED | SQL is prepared and not applied. |
| Stale-load review mark on the live database | BLOCKED | SQL is prepared and not applied. |
| Secret rotation | BLOCKED | Checklist only. No secret was read or changed. |
| Rollback to the old deployment | BLOCKED | That deployment has no money switches. |
| Eight high dependency findings | BLOCKED | Not cleared. Not exploited in this session. |
| Legal approval | NOT VERIFIED | Counsel has not signed the age, state, or sweepstakes rules. |
| Payment-provider approval | NOT VERIFIED | No approval document was found. |
| Live deposit, payout, and game transfer | NOT VERIFIED | No real money movement was attempted. |
| Mail, SMS, Telegram, and cron | NOT VERIFIED | Secret names are absent. |
| Backups and restore | NOT VERIFIED | No backup screen and no restore drill. |
| Mobile layout | NOT VERIFIED | Public URLs were checked. A phone viewport was not clicked. |

Real-money launch remains NO-GO.
