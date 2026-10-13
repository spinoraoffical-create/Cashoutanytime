import assert from "node:assert/strict";

import { classifyJob, needsPersonPayout } from "../src/lib/automation/health-rules.ts";

const now = new Date("2026-10-13T12:00:00.000Z");

assert.equal(
  classifyJob({ scheduled: false, switchOn: true, lastRunAt: now.toISOString(), expectedEveryHours: 24, now }),
  "not_scheduled"
);
assert.equal(
  classifyJob({ scheduled: true, switchOn: false, lastRunAt: null, expectedEveryHours: 24, now }),
  "off"
);
assert.equal(
  classifyJob({ scheduled: true, switchOn: null, lastRunAt: null, expectedEveryHours: 24, now }),
  "unknown"
);
assert.equal(
  classifyJob({
    scheduled: true,
    switchOn: true,
    lastRunAt: "2026-10-10T12:00:00.000Z",
    expectedEveryHours: 24,
    now,
  }),
  "stale"
);
assert.equal(
  classifyJob({
    scheduled: true,
    switchOn: true,
    lastRunAt: "2026-10-13T08:00:00.000Z",
    expectedEveryHours: 24,
    now,
  }),
  "ok"
);

assert.equal(needsPersonPayout("submitted", null), true);
assert.equal(needsPersonPayout("submitted", "paid"), false);
assert.equal(needsPersonPayout("paid", null), false);
assert.equal(needsPersonPayout("failed", null), false);

console.log("automation health checks passed");
