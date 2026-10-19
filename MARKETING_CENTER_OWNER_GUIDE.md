# How to use the Marketing Center

Open https://www.sweeptakehub.com/admin/marketing-center after you sign in as staff.

## 1. Email campaign

Choose Create campaign. Pick an objective and an audience. The number next to the audience is how many saved accounts still match. Leave the confirmation box empty and press Save campaign. That stores a draft and emails nobody.

## 2. SMS

This form does not send texts. Text one player copies one message. One-time offers can text only people whose SMS switch is on. Twilio is not set on the live site yet, so bulk texting will not go out.

## 3. Telegram

Open Telegram channel. Read the warning if promo and staff alerts share one chat. Press the existing send button only when you mean to post. This deploy does not post by itself.

## 4. Who receives email

Only people who still have promotional email on, have an email address, and are not suspended. The count can say incomplete if the read hits its safety cap.

## 5. Preview and schedule

The draft uses the existing email template and an unsubscribe link. To schedule, enter a time and check the confirmation box before saving. The sender runs once a day at 09:00 UTC. It will not run until the site has a cron secret. A time earlier the same day waits until the next morning.

## 6. Did it send

Provider-accepted means Resend took the request. It does not mean the person opened it. Confirmed delivery says Not tracked.

## 7. Results

Clicks, new customers tied to a campaign, and revenue say Not tracked. Do not read a wallet balance as campaign profit.

## 8. Common setup messages

- Unavailable means that one count could not be read. It is not zero.
- RESEND_API_KEY is missing means email cannot send.
- Twilio is not fully configured means SMS cannot send.
- Cron not configured means a scheduled email stays waiting.
- Set TELEGRAM_PROMO_CHAT_ID before promotions so they do not use the staff alert chat.
