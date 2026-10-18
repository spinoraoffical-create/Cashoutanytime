import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { missedAuditMessage, partialAuditResult } from "../src/lib/admin/audit-result.ts";

function read(path) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const logged = missedAuditMessage("deposit.credit");
assert.equal(logged, "deposit.credit audit row was not saved");
assert.equal(logged.includes("$"), false);
const hidden = missedAuditMessage("user 123 balance $50");
assert.equal(hidden, "audit audit row was not saved");
assert.equal(hidden.includes("$"), false);
assert.equal(hidden.includes("123"), false);

let credits = 0;
function deliver(audited, duplicate) {
  if (duplicate) return { credited: false, duplicate: true, retriedCredit: false };
  credits += 1;
  if (!audited) missedAuditMessage("deposit.credit");
  return { credited: true, duplicate: false, retriedCredit: false, ...partialAuditResult(audited) };
}
const first = deliver(false, false);
const again = deliver(true, true);
assert.equal(credits, 1);
assert.equal(first.credited, true);
assert.equal(first.auditWarning != null, true);
assert.equal(again.duplicate, true);
assert.equal(again.retriedCredit, false);

const wallet = read("../src/lib/payments/paydora-wallet.ts");
const settle = read("../src/lib/payments/auto-settle.ts");
const webhook = read("../src/app/api/payments/paydora/webhook/route.ts");
assert.match(wallet, /if \(!audited\) logIncident\("audit", missedAuditMessage\("deposit\.credit"\)\)/);
assert.match(wallet, /if \(!audited\) logIncident\("audit", missedAuditMessage\("deposit\.refund"\)\)/);
assert.match(wallet, /if \(!audited\) logIncident\("audit", missedAuditMessage\("deposit\.payout_void"\)\)/);
assert.match(settle, /if \(!audited\) logIncident\("audit", missedAuditMessage\("deposit\.auto_settle"\)\)/);
assert.ok(wallet.indexOf("alreadyApplied") < wallet.indexOf('action: "deposit.credit"'));
assert.equal((wallet.match(/\.rpc\("credit_paydora_deposit"/g) ?? []).length, 1);
assert.match(webhook, /return new NextResponse\("RETRY", \{ status: 500 \}\)/);
assert.equal(webhook.includes("missedAuditMessage"), false);

const users = read("../src/lib/actions/admin/users.ts");
const ban = users.slice(users.indexOf("export async function setBanAction"), users.indexOf("export async function deleteUserAccountAction"));
const remove = users.slice(users.indexOf("export async function deleteUserAccountAction"), users.indexOf("const adjustSchema"));
const roles = users.slice(users.indexOf("export async function setUserRolesAction"));
assert.ok(ban.indexOf('authorize("users.manage")') < ban.indexOf(".update("));
assert.match(ban, /partialAuditResult\(audited\)/);
assert.equal(ban.includes('ok: false, error: "The roles were saved'), false);
assert.ok(remove.indexOf('authorize("users.delete")') < remove.indexOf("admin_delete_user_account"));
assert.match(remove, /partialAuditResult\(audited\)/);
assert.ok(roles.indexOf('authorize("users.roles")') < roles.indexOf(".delete("));
assert.match(roles, /Could not update roles/);
assert.match(roles, /Could not assign the new roles/);
assert.match(roles, /partialAuditResult\(audited\)/);
assert.equal(roles.includes("The roles were saved, but they were not written"), false);

const agents = read("../src/lib/actions/agents.ts");
const reset = agents.slice(agents.indexOf("export async function resetAgentPasswordAction"), agents.indexOf("async function agentInScope"));
assert.ok(reset.indexOf("password.length < 8") < reset.indexOf("updateUserById"));
assert.ok(reset.indexOf("if (error) return") < reset.indexOf("writeAudit"));
assert.match(reset, /partialAuditResult\(audited\)/);

const kycSql = read("../supabase/migrations/20261014000160_admin_decide_kyc.sql");
assert.match(kycSql, /auth\.role\(\) IS DISTINCT FROM 'service_role'/);
assert.match(kycSql, /actor not found/);
assert.match(kycSql, /FOR UPDATE/);
assert.match(kycSql, /player profile not found/);
assert.match(kycSql, /IF v_row\.status = p_status AND v_current_profile = v_profile_status THEN/);
assert.match(kycSql, /INSERT INTO public\.audit_logs/);
assert.match(kycSql, /REVOKE ALL ON FUNCTION public\.admin_decide_kyc/);
assert.match(kycSql, /GRANT EXECUTE ON FUNCTION public\.admin_decide_kyc/);
assert.match(kycSql, /TO service_role/);
assert.equal(kycSql.includes("document_url"), false);
const kycApp = read("../src/lib/actions/kyc-actions.ts");
const decision = kycApp.slice(
  kycApp.indexOf("export async function updateKYCStatus"),
  kycApp.indexOf("export async function getPlayerKYCStatus")
);
assert.equal((decision.match(/\.rpc\("admin_decide_kyc"/g) ?? []).length, 1);
assert.ok(decision.indexOf('authorize("kyc.manage")') < decision.indexOf('.rpc("admin_decide_kyc"'));
assert.match(decision, /p_status: newStatus/);
assert.match(decision, /identityDecisionMessage\(error\)/);
assert.equal(decision.includes("writeAudit"), false);
assert.equal(decision.includes(".update("), false);
assert.match(kycSql, /CASE WHEN p_status = 'approved' THEN 'verified' ELSE 'rejected'/);

const indexSql = read("../supabase/migrations/20261014000170_profiles_last_seen_at_index.sql");
assert.match(indexSql, /ADD COLUMN IF NOT EXISTS last_seen_at timestamptz/);
assert.equal(/default\s+now\(\)/i.test(indexSql), false);
assert.match(indexSql, /CREATE INDEX IF NOT EXISTS profiles_last_seen_at_idx/);
assert.match(indexSql, /ON public\.profiles \(last_seen_at\)/);
const dashboard = read("../src/app/admin/page.tsx");
assert.match(dashboard, /gte\("last_seen_at", dayStart\)/);
assert.match(dashboard, /if \(error\) return null/);

console.log("phase 3d release blocker checks passed");
