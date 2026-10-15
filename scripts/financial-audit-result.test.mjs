import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { AUDIT_SAVED_WARNING, partialAuditResult, payoutOperatorMessage } from "../src/lib/admin/audit-result.ts";

function settle(mutated, audited) {
  if (!mutated) return { ok: false, error: payoutOperatorMessage("rpc failed") };
  return { ok: true, message: "Paid out.", ...partialAuditResult(audited) };
}

const saved = settle(true, true);
assert.equal(saved.ok, true);
assert.equal(saved.auditWarning, undefined);
assert.equal(saved.message, "Paid out.");

const partial = settle(true, false);
assert.equal(partial.ok, true);
assert.equal(partial.auditWarning, AUDIT_SAVED_WARNING);
assert.match(partial.auditWarning, /not undone/);
assert.equal(partial.error, undefined);

const failed = settle(false, false);
assert.equal(failed.ok, false);
assert.equal(failed.auditWarning, undefined);
assert.equal(failed.error, "The cash-out could not be recorded.");

let mutations = 0;
function oneAttempt(audited) {
  mutations += 1;
  return { ok: true, ...partialAuditResult(audited) };
}
const first = oneAttempt(false);
const second = oneAttempt(true);
assert.equal(mutations, 2);
assert.equal(first.ok, true);
assert.equal(second.auditWarning, undefined);

const rawSql = "function admin_payout_cashout(uuid) does not exist";
const safe = payoutOperatorMessage(rawSql);
assert.equal(safe, "The cash-out could not be recorded.");
assert.equal(safe.includes("admin_payout_cashout"), false);
assert.equal(safe.includes("uuid"), false);
assert.equal(
  payoutOperatorMessage("insufficient cash-out balance"),
  "The cash-out balance is too low for that amount."
);

function read(path) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

function between(source, start, end) {
  const from = source.indexOf(start);
  const to = end ? source.indexOf(end, from + start.length) : source.length;
  assert.ok(from >= 0, start);
  return source.slice(from, to === -1 ? source.length : to);
}

const payout = between(read("../src/lib/actions/admin/payouts.ts"), "export async function payoutCashout", "");
assert.equal((payout.match(/admin_payout_cashout/g) ?? []).length, 1);
assert.ok(payout.indexOf("admin_payout_cashout") < payout.indexOf("writeAudit"));
assert.ok(payout.indexOf("payoutOperatorMessage") < payout.indexOf("writeAudit"));
assert.match(payout, /partialAuditResult\(audited\)/);
assert.equal(payout.includes("error: error.message"), false);
assert.match(payout, /ok: false/);

const users = read("../src/lib/actions/admin/users.ts");
for (const name of ["adjustBalanceAction", "adjustWalletAction", "recordCashoutPayoutAction"]) {
  const next = name === "adjustBalanceAction" ? "adjustWalletAction" : name === "adjustWalletAction" ? "recordCashoutPayoutAction" : "setUserRolesAction";
  const body = between(users, `export async function ${name}`, `export async function ${next}`);
  assert.match(body, /partialAuditResult\(audited\)/);
  assert.ok(body.indexOf(".rpc(") < body.indexOf("writeAudit"));
  assert.equal((body.match(/\.rpc\(/g) ?? []).length, 1);
  assert.equal(body.includes("ok: false, error: error.message"), false);
}

const deposits = between(read("../src/lib/actions/deposits.ts"), "export async function updateDepositStatus", "");
assert.match(deposits, /The wallet is credited when Paydora confirms the payment/);
assert.ok(deposits.indexOf('status === "completed"') < deposits.indexOf(".update("));
assert.equal((deposits.match(/\.update\(/g) ?? []).length, 1);
assert.match(deposits, /partialAuditResult\(audited\)/);
assert.equal(deposits.includes("error.message"), false);
assert.match(deposits, /The deposit status could not be saved/);

const agents = read("../src/lib/actions/agents.ts");
for (const action of ["agent.create", "agent.activate", "agent.update", "agent.password_reset", "player.move_parent"]) {
  assert.match(agents, new RegExp(action));
}
assert.equal((agents.match(/partialAuditResult\(audited\)/g) ?? []).length, 5);

const payoutForm = read("../src/components/admin/payout-form.tsx");
assert.ok(payoutForm.indexOf("res.auditWarning") < payoutForm.indexOf("toast.success"));
assert.match(payoutForm, /toast\.warning\(res\.auditWarning\)/);
assert.match(payoutForm, /toast\.error\(res\.error\)/);

console.log("financial audit result checks passed");
