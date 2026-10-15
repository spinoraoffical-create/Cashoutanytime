import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { confirmActionDecision } from "../src/lib/admin/confirm-gate.ts";
import {
  automationJobHelp,
  blogStatusHelp,
  newsletterStatusHelp,
  promotionStatusHelp,
} from "../src/lib/admin/marketing-status.ts";

function read(path) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const center = read("../src/app/admin/marketing-center/page.tsx");
const newsletters = read("../src/app/admin/newsletters/page.tsx");
const offers = read("../src/app/admin/offers/page.tsx");
const offerForm = read("../src/components/admin/offer-send-form.tsx");
const telegram = read("../src/app/admin/telegram/page.tsx");
const automation = read("../src/app/admin/automation/page.tsx");
const blog = read("../src/app/admin/ai-blog/page.tsx");
const marketing = read("../src/app/admin/marketing/page.tsx");
const notifications = read("../src/app/admin/notifications/page.tsx");
const promotions = read("../src/app/admin/promotions/page.tsx");

assert.match(center, /redirect\("\/admin"\)/);
assert.match(center, /newsletters\.manage/);
assert.match(center, /href: "\/admin\/newsletters"/);
assert.match(center, /href: "\/admin\/marketing"/);
assert.match(center, /href: "\/admin\/telegram"/);
assert.match(center, /href: "\/admin\/notifications"/);
assert.match(center, /href: "\/admin\/promotions"/);
assert.match(center, /href: "\/admin\/offers"/);
assert.match(center, /store_creator/);
assert.match(center, /sub_creator/);

assert.match(newsletters, /requirePermission\("newsletters\.manage"\)/);
assert.match(newsletters, /newsletter_campaigns/);
assert.match(newsletters, /upsertNewsletterCampaignAction/);
assert.match(newsletters, /deleteNewsletterCampaignAction/);
assert.match(newsletters, /NewsletterSendControls/);
assert.equal(newsletters.includes("sendNewsletterTestAction"), false);

assert.match(offers, /offerScopeForCurrentUser/);
assert.match(offers, /countOfferAudience/);
assert.match(offers, /redirect\("\/admin"\)/);
assert.match(offerForm, /sendOfferAction/);
assert.match(offerForm, /disabled=\{busy\}/);

const offerSubmit = offerForm.slice(offerForm.indexOf("async function onSubmit"), offerForm.indexOf("return ("));
assert.ok(offerSubmit.indexOf('confirmActionDecision({ pending: busy') < offerSubmit.indexOf("window.confirm"));
assert.ok(offerSubmit.indexOf("window.confirm") < offerSubmit.indexOf("sendOfferAction"));
assert.match(offerSubmit, /decision !== "run"\) return/);
assert.equal((offerSubmit.match(/sendOfferAction\(/g) ?? []).length, 1);

let offerRuns = 0;
function attemptOffer(pending, confirmed) {
  const decision = confirmActionDecision({ pending, confirmed });
  if (decision !== "run") return decision;
  offerRuns += 1;
  return decision;
}
assert.equal(attemptOffer(false, false), "cancelled");
assert.equal(offerRuns, 0);
assert.equal(attemptOffer(true, true), "pending");
assert.equal(offerRuns, 0);
assert.equal(attemptOffer(false, true), "run");
assert.equal(offerRuns, 1);
assert.equal(attemptOffer(true, true), "pending");
assert.equal(offerRuns, 1);

assert.match(telegram, /requirePermission\("cms\.manage"\)/);
assert.match(telegram, /isTelegramConfigured/);
assert.match(telegram, /TelegramBroadcastCard/);
assert.match(telegram, /AdminAutopilotCard/);
assert.match(telegram, /AdminTelegramTester/);
assert.equal(telegram.includes("process.env.TELEGRAM_ADMIN_CHAT_ID }"), false);
assert.equal(telegram.includes("TELEGRAM_BOT_TOKEN }"), false);

assert.match(automation, /redirect\("\/admin"\)/);
assert.match(automation, /loadAutomationHealth/);
assert.match(automation, /href: "\/admin\/ai-blog"/);
assert.match(automation, /href: "\/admin\/ai-bot"/);
assert.match(automation, /href: "\/admin\/analyzer"/);
assert.equal(automation.includes("fetch("), false);

assert.match(blog, /requirePermission\("cms\.manage"\)/);
assert.match(blog, /AIBlogGeneratorCard/);
assert.match(blog, /blog_posts/);
assert.match(blog, /\.limit\(10\)/);

assert.match(marketing, /requirePermission\("cms\.manage"\)/);
assert.match(marketing, /getConsentedPhoneOutreach/);
assert.match(marketing, /AdminPlayerFollowupCard/);

assert.match(notifications, /requirePermission\("notifications\.broadcast"\)/);
assert.match(notifications, /BroadcastComposer/);
assert.match(notifications, /from\("broadcasts"\)/);

assert.match(promotions, /requirePermission\("promotions\.manage"\)/);
assert.match(promotions, /deletePromotionAction/);
assert.match(promotions, /PromotionFormDialog/);
assert.match(promotions, /from\("promotions"\)/);

assert.match(newsletterStatusHelp("draft"), /has not been sent/);
assert.match(newsletterStatusHelp("scheduled"), /not finished sending/);
assert.match(newsletterStatusHelp("sending"), /in progress/);
assert.match(newsletterStatusHelp("sent"), /finished/);
assert.match(newsletterStatusHelp("failed"), /not a new send/);
assert.match(promotionStatusHelp("active"), /Turned on/);
assert.match(blogStatusHelp("published"), /published/);
assert.match(automationJobHelp("not_scheduled"), /does not mean it is running/);
assert.match(automationJobHelp("stale"), /later than expected/);
assert.equal(automationJobHelp("ok").includes("failed"), false);

console.log("marketing center ui checks passed");
