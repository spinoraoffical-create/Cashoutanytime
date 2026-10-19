import assert from "node:assert/strict";

import {
  campaignOwnerStatus,
  emailProviderStatusLabel,
  MARKETING_CRON_JOBS,
  parseMarketingRange,
} from "../src/lib/admin/marketing-center-rules.ts";

const now = Date.parse("2026-10-19T00:00:00.000Z");
const week = parseMarketingRange({ range: "7" }, now);
assert.equal(week.label, "Last 7 days");
assert.equal(week.since, "2026-10-12T00:00:00.000Z");
assert.equal(emailProviderStatusLabel("sent"), "Accepted by the email provider");
assert.equal(emailProviderStatusLabel("pending"), "Waiting to send");
assert.notEqual(emailProviderStatusLabel("sent"), "Delivered");
assert.equal(campaignOwnerStatus({ status: "sent", failedCount: 2 }), "Partially Failed");
assert.equal(campaignOwnerStatus({ status: "scheduled" }), "Scheduled");
assert.equal(campaignOwnerStatus({ status: "draft" }), "Draft");
assert.equal(MARKETING_CRON_JOBS.find((job) => job.path === "/api/cron/auto-blog")?.scheduled, false);
assert.equal(MARKETING_CRON_JOBS.find((job) => job.path === "/api/cron/newsletter-send")?.scheduled, true);

console.log("marketing center checks passed");
