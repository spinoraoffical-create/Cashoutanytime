import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  formatNepalInputValue,
  formatNepalTime,
  NEPAL_TIME_NOTE,
  parseNepalLocalToUtc,
} from "../src/lib/admin/nepal-time.ts";
import { parseMarketingRange } from "../src/lib/admin/marketing-center-rules.ts";

const utc = new Date("2026-10-20T11:17:00.000Z");
assert.equal(formatNepalTime(utc), "20 Oct 2026, 5:02 PM NPT");
assert.equal(formatNepalInputValue(utc), "2026-10-20T17:02");
assert.equal(parseNepalLocalToUtc("2026-10-20T17:02")?.toISOString(), "2026-10-20T11:17:00.000Z");
assert.equal(parseNepalLocalToUtc(formatNepalInputValue(utc))?.toISOString(), utc.toISOString());
assert.equal(parseNepalLocalToUtc("2026-10-20T11:17:00.000Z")?.toISOString(), "2026-10-20T11:17:00.000Z");
assert.equal(parseNepalLocalToUtc("2026-13-01T00:00"), null);
assert.match(NEPAL_TIME_NOTE, /Nepal Time/);

const range = parseMarketingRange({
  range: "custom",
  from: parseNepalLocalToUtc("2026-10-20T17:02")?.toISOString(),
  to: parseNepalLocalToUtc("2026-10-20T18:02")?.toISOString(),
});
assert.equal(range.since, "2026-10-20T11:17:00.000Z");
assert.equal(range.until, "2026-10-20T12:17:00.000Z");

const stored = parseMarketingRange({
  range: "custom",
  from: "2026-10-20T11:17:00.000Z",
  to: "2026-10-20T12:17:00.000Z",
});
assert.equal(stored.since, "2026-10-20T11:17:00.000Z");
assert.equal(stored.until, "2026-10-20T12:17:00.000Z");

function read(path) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const topbar = read("../src/components/admin/admin-topbar.tsx");
const sidebar = read("../src/components/admin/admin-sidebar.tsx");
const menu = read("../src/components/layout/user-account-menu.tsx");
const openAdmin = read("../src/lib/actions/admin/open-admin.ts");
const sendControls = read("../src/components/admin/newsletter-send-controls.tsx");

assert.match(topbar, /Exit Admin/);
assert.match(topbar, /href="\/dashboard"/);
assert.equal(topbar.includes("logoutAction"), false);
assert.match(sidebar, /Exit Admin/);
assert.match(sidebar, /href="\/dashboard"/);
assert.match(sidebar, /logoutAction/);
assert.match(menu, /Open Admin/);
assert.match(menu, /showAdmin/);
assert.match(menu, /staffCanOpenAdmin/);
assert.match(openAdmin, /getStaffContext/);
assert.match(read("../src/app/admin/marketing-center/page.tsx"), /parseNepalLocalToUtc/);
assert.match(sendControls, /parseNepalLocalToUtc/);
assert.match(sendControls, /That Nepal time has already passed/);
assert.equal(sendControls.includes("scheduleNewsletterCampaignAction(campaignId, null)"), true);

const existingCampaignInstant = "2026-10-20T11:17:40.000Z";
assert.equal(parseNepalLocalToUtc(existingCampaignInstant)?.toISOString(), existingCampaignInstant);
assert.equal(formatNepalInputValue(existingCampaignInstant), "2026-10-20T17:02");
assert.equal(parseNepalLocalToUtc(formatNepalInputValue(existingCampaignInstant))?.toISOString(), "2026-10-20T11:17:00.000Z");

const createAction = read("../src/app/admin/marketing-center/actions.ts");
const createPage = read("../src/app/admin/marketing-center/create/page.tsx");
const cmsAction = read("../src/lib/actions/admin/cms.ts");
const cmsPage = read("../src/app/admin/cms/page.tsx");
const blogDialog = read("../src/components/admin/blog-post-edit-dialog.tsx");
const cron = read("../vercel.json");

assert.match(createPage, /Schedule time \(Nepal time, UTC\+05:45\)/);
assert.match(createAction, /parseNepalLocalToUtc\(when\)/);
assert.match(createAction, /scheduleNewsletterCampaignAction\(saved\.id, scheduledAt\.toISOString\(\)\)/);
assert.equal(createAction.includes("new Date(when)"), false);
assert.equal(createAction.includes("68f5146a"), false);
assert.match(cmsAction, /parseNepalLocalToUtc\(parsed\.data\.published_at\)/);
assert.match(cmsAction, /nepalInstant\(parsed\.data\.starts_at\)/);
assert.equal(cmsAction.includes("new Date(parsed.data.starts_at)"), false);
assert.equal(cmsAction.includes("new Date(published_at)"), false);
assert.match(cmsPage, /formatNepalInputValue/);
assert.match(cmsPage, /Starts at \(Nepal time\)/);
assert.match(blogDialog, /formatNepalInputValue/);
assert.match(blogDialog, /Nepal time, scheduled only/);
assert.match(cron, /"path": "\/api\/cron\/newsletter-send"/);
assert.match(cron, /"schedule": "0 9 \* \* \*"/);

console.log("nepal time checks passed");
