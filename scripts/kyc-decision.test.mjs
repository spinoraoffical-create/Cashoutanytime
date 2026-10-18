import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  applyReviewDecision,
  identityDecisionLogCode,
  identityDecisionMessage,
  reviewCounts,
} from "../src/lib/kyc/decision.ts";

const pending = [
  { user_id: "player-1", status: "pending" },
  { user_id: "player-2", status: "pending" },
];

const approved = applyReviewDecision(pending, "player-1", "approved");
assert.equal(approved.find((row) => row.user_id === "player-1").status, "approved");
assert.equal(approved.find((row) => row.user_id === "player-2").status, "pending");
assert.deepEqual(reviewCounts(approved), { all: 2, pending: 1, approved: 1, rejected: 0 });

const rejected = applyReviewDecision(pending, "player-2", "rejected");
assert.equal(rejected.find((row) => row.user_id === "player-2").status, "rejected");
assert.deepEqual(reviewCounts(rejected), { all: 2, pending: 1, approved: 0, rejected: 1 });

const unchanged = applyReviewDecision(approved, "missing-player", "rejected");
assert.deepEqual(unchanged, approved);

assert.equal(identityDecisionMessage({ code: "42501", message: "column protected" }), "The identity status could not be saved. The profile guard blocked the status change.");
assert.equal(identityDecisionLogCode({ code: "42501", message: "column protected" }), "column_protected");
assert.equal(identityDecisionMessage({ message: "player profile not found" }), "The identity status could not be saved. The check was left as it was.");
assert.equal(identityDecisionMessage({ code: "PGRST202", message: "Could not find the function public.admin_decide_kyc" }), "Identity review is not ready on this server.");
assert.equal(identityDecisionMessage({ message: "service role required" }), "The identity status could not be saved.");
assert.equal(identityDecisionLogCode({ message: "actor not found" }), "actor_not_found");
assert.equal(/eyJ|document_url|password|@/.test(identityDecisionMessage({ message: "player@example.com document leaked" })), false);
assert.equal(identityDecisionLogCode({ message: "player@example.com" }), "unclassified");

const sql = readFileSync(new URL("../supabase/migrations/20261017000500_kyc_decision_profile_guard.sql", import.meta.url), "utf8");
const decisionSql = sql.slice(sql.indexOf("FUNCTION public.admin_decide_kyc"));
const profileUpdate = decisionSql.indexOf("UPDATE public.profiles");
const flag = decisionSql.indexOf("PERFORM set_config('app.kyc_status_update', 'true', true);");
const flagOff = decisionSql.indexOf("PERFORM set_config('app.kyc_status_update', 'false', true);");
assert.ok(flag > 0 && flag < profileUpdate);
assert.ok(flagOff > profileUpdate);
assert.equal(decisionSql.includes("app.wallet_update"), false);
const guard = sql.slice(sql.indexOf("FUNCTION public.protect_profile_columns"), sql.indexOf("FUNCTION public.admin_decide_kyc"));
const narrow = guard.indexOf("app.kyc_status_update");
const walletBypass = guard.indexOf("app.wallet_update");
assert.ok(narrow > 0 && narrow < walletBypass);
assert.match(guard, /wallet_balance/);
assert.match(sql, /IF v_row\.status = p_status AND v_current_profile = v_profile_status THEN\s+RETURN;/);
assert.match(sql, /REVOKE ALL ON FUNCTION public\.admin_decide_kyc/);
assert.match(sql, /TO service_role/);
assert.equal(sql.includes("document_url"), false);
assert.equal(decisionSql.includes("wallet_balance"), false);

const actions = readFileSync(new URL("../src/lib/actions/kyc-actions.ts", import.meta.url), "utf8");
const decision = actions.slice(actions.indexOf("export async function updateKYCStatus"), actions.indexOf("export async function getPlayerKYCStatus"));
assert.ok(decision.indexOf('authorize("kyc.manage")') < decision.indexOf('.rpc("admin_decide_kyc"'));
assert.match(decision, /KYC submission not found/);
assert.match(decision, /identityDecisionMessage/);
assert.equal(decision.includes(".update("), false);
assert.equal(decision.includes("writeAudit"), false);

const card = readFileSync(new URL("../src/components/admin/admin-kyc-review-card.tsx", import.meta.url), "utf8");
assert.match(card, /Identity verification approved\./);
assert.match(card, /Identity verification rejected\./);
assert.match(card, /savingId/);
assert.match(card, /applyReviewDecision/);

console.log("kyc decision checks passed");
