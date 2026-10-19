import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  PLAYER_CHAT_PATH,
  PLAYER_INBOX_PATH,
  canNotifyConfirmedStatus,
  lockScreenText,
  planPromotionalPush,
  pushEnableHelp,
  pushResultLabel,
  safeNotificationPath,
  sameOwnerSubscription,
} from "../src/lib/notifications/player-notice-rules.ts";

assert.equal(PLAYER_INBOX_PATH, "/dashboard/inbox");
assert.equal(PLAYER_CHAT_PATH, "/dashboard/messages");
assert.notEqual(PLAYER_INBOX_PATH, PLAYER_CHAT_PATH);

const mobileBell = readFileSync("src/components/home/lobby/lobby-top-bar.tsx", "utf8");
const desktopBell = readFileSync("src/components/home/lobby/lobby-desktop-header.tsx", "utf8");
const chatPage = readFileSync("src/app/dashboard/messages/page.tsx", "utf8");
assert.match(mobileBell, /PLAYER_INBOX_PATH/);
assert.match(desktopBell, /PLAYER_INBOX_PATH/);
assert.equal(mobileBell.includes('href="/dashboard/messages"'), false);
assert.equal(desktopBell.includes('href="/dashboard/messages"'), false);
assert.match(chatPage, /Live chat/);

assert.equal(safeNotificationPath("/dashboard/inbox"), "/dashboard/inbox");
assert.equal(safeNotificationPath("https://evil.example"), null);
assert.equal(safeNotificationPath("//evil.example"), null);
assert.equal(canNotifyConfirmedStatus("pending", false), false);
assert.equal(canNotifyConfirmedStatus("paid", false), false);
assert.equal(canNotifyConfirmedStatus("paid", true), true);
assert.equal(lockScreenText("Your cash-out of $16.49 is ready").includes("$"), false);
assert.match(pushEnableHelp("denied"), /blocked/i);
assert.equal(pushResultLabel(410), "expired");
assert.equal(pushResultLabel(201), "accepted");
assert.equal(sameOwnerSubscription("player-a", "player-b"), false);

const plan = planPromotionalPush([
  { subscriptionId: "ok", userId: "a", marketingOptIn: true, expired: false, alreadyAccepted: false },
  { subscriptionId: "out", userId: "b", marketingOptIn: false, expired: false, alreadyAccepted: false },
  { subscriptionId: "old", userId: "c", marketingOptIn: true, expired: true, alreadyAccepted: false },
  { subscriptionId: "dup", userId: "d", marketingOptIn: true, expired: false, alreadyAccepted: true },
]);
assert.deepEqual(plan.send, ["ok"]);
assert.equal(plan.optedOut, 1);
assert.equal(plan.expired, 1);
assert.equal(plan.alreadyAccepted, 1);

const broadcast = readFileSync("src/lib/actions/admin/broadcasts.ts", "utf8");
assert.match(broadcast, /sendBroadcastPush/);
assert.match(broadcast, /request_id/);

console.log("notification inbox checks passed");
