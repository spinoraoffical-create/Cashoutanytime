import assert from "node:assert/strict";

import {
  executeBroadcast,
  publicBroadcastError,
  resolveVipRank,
  safeBroadcastDiagnostic,
  selectBroadcastRecipients,
} from "../src/lib/notifications/broadcast-rules.ts";

const people = [
  { userId: "member", suspended: false, announcements: true, vipRank: 0, parentAgentId: "store-a" },
  { userId: "gold", suspended: false, announcements: true, vipRank: resolveVipRank(null, "gold"), parentAgentId: "store-a" },
  { userId: "opted-out", suspended: false, announcements: false, vipRank: 5, parentAgentId: "store-a" },
  { userId: "no-prefs", suspended: false, announcements: null, vipRank: 5, parentAgentId: "store-a" },
  { userId: "suspended", suspended: true, announcements: true, vipRank: 5, parentAgentId: "store-a" },
  { userId: "other-store", suspended: false, announcements: true, vipRank: 5, parentAgentId: "store-b" },
];

const all = selectBroadcastRecipients(people, "all", { level: "platform", parentIds: [] });
assert.deepEqual(all.recipients.sort(), ["gold", "member", "other-store"]);

const vip = selectBroadcastRecipients(people, "vip_gold_up", { level: "platform", parentIds: [] });
assert.deepEqual(vip.recipients.sort(), ["gold", "other-store"]);

const elite = selectBroadcastRecipients(people, "vip_elite", { level: "platform", parentIds: [] });
assert.deepEqual(elite.recipients, ["other-store"]);

const store = selectBroadcastRecipients(people, "all", { level: "store", parentIds: ["store-a"] });
assert.deepEqual(store.recipients.sort(), ["gold", "member"]);
assert.equal(store.recipients.includes("other-store"), false);

assert.equal(resolveVipRank(4, "bronze"), 4);
assert.equal(resolveVipRank(null, "silver"), 1);

const denied = await executeBroadcast({
  permitted: false,
  draft: { id: "11111111-1111-4111-8111-111111111111", actorId: "staff", title: "Hello there", body: "A short notice", linkUrl: null, segment: "all" },
  candidates: people,
  audienceComplete: true,
  scope: { level: "platform", parentIds: [] },
  repo: {
    async get() { throw new Error("should not read"); },
    async create() { throw new Error("should not write"); },
    async addRecipients() { throw new Error("should not write"); },
    async finish() { throw new Error("should not write"); },
  },
});
assert.equal(denied.ok, false);
assert.match(denied.error, /permission/i);

function memoryRepo(failRecipients = false) {
  const rows = new Map();
  return {
    rows,
    async get(id) { return rows.get(id) ?? null; },
    async create(record) {
      if (rows.has(record.id)) return { code: "23505", message: "duplicate" };
      rows.set(record.id, { ...record, recipientIds: [] });
      return null;
    },
    async addRecipients(id, userIds) {
      if (failRecipients) return { code: "42501", message: "permission denied for player@example.com 11111111-1111-4111-8111-111111111111" };
      const row = rows.get(id);
      row.recipientIds = [...row.recipientIds, ...userIds];
      return null;
    },
    async finish(id, total) {
      const row = rows.get(id);
      row.total = total;
      return null;
    },
  };
}

const draft = {
  id: "22222222-2222-4222-8222-222222222222",
  actorId: "staff",
  title: "Hello there",
  body: "A short notice",
  linkUrl: "/promotions",
  segment: "all",
};

const failing = memoryRepo(true);
const failed = await executeBroadcast({
  permitted: true,
  draft,
  candidates: people,
  audienceComplete: true,
  scope: { level: "platform", parentIds: [] },
  repo: failing,
});
assert.equal(failed.ok, false);
assert.equal(failed.error, "You don't have permission to save this notice. Nothing was sent.");
assert.equal(failed.error.includes("player@example.com"), false);
assert.deepEqual(failing.rows.get(draft.id).recipientIds, []);
assert.equal(publicBroadcastError("PGRST202", "Could not find the function public.send_broadcast").includes("send_broadcast"), false);
assert.equal(safeBroadcastDiagnostic("failed for player@example.com id 22222222-2222-4222-8222-222222222222").includes("@"), false);

const repo = memoryRepo(false);
const first = await executeBroadcast({
  permitted: true,
  draft,
  candidates: people,
  audienceComplete: true,
  scope: { level: "store", parentIds: ["store-a"] },
  repo,
});
assert.equal(first.ok, true);
assert.equal(first.added, 2);
assert.equal(first.total, 2);

const retry = await executeBroadcast({
  permitted: true,
  draft,
  candidates: people,
  audienceComplete: true,
  scope: { level: "store", parentIds: ["store-a"] },
  repo,
});
assert.equal(retry.ok, true);
assert.equal(retry.added, 0);
assert.equal(retry.total, 2);
assert.equal(repo.rows.get(draft.id).recipientIds.length, 2);

const incomplete = await executeBroadcast({
  permitted: true,
  draft: { ...draft, id: "33333333-3333-4333-8333-333333333333" },
  candidates: people,
  audienceComplete: false,
  scope: { level: "platform", parentIds: [] },
  repo,
});
assert.equal(incomplete.ok, false);
assert.match(incomplete.error, /Nothing was sent/);
assert.equal(repo.rows.has("33333333-3333-4333-8333-333333333333"), false);

console.log("broadcast notice checks passed");
