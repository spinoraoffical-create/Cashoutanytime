import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(
  new URL("../supabase/migrations/20261015000180_hold_stale_game_loads.sql", import.meta.url),
  "utf8"
);
const body = sql.slice(sql.indexOf("AS $$"), sql.indexOf("REVOKE ALL"));

assert.match(sql, /CREATE OR REPLACE FUNCTION public\.fail_stale_game_loads\(\s*p_stale_minutes integer DEFAULT 15,\s*p_user_id uuid DEFAULT NULL,\s*p_game_slug text DEFAULT NULL\s*\)\s*RETURNS integer/);
assert.match(sql, /REVOKE ALL ON FUNCTION public\.fail_stale_game_loads\(integer, uuid, text\) FROM PUBLIC, anon, authenticated/);
assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.fail_stale_game_loads\(integer, uuid, text\) TO service_role/);
assert.match(body, /RETURN 0;/);
assert.equal(body.includes("refund_game_load_wallet"), false);
assert.equal(body.includes("UPDATE"), false);
assert.equal(body.includes("INSERT"), false);
assert.equal(body.includes("DELETE"), false);
assert.equal(body.includes("status = 'failed'"), false);
assert.equal(body.includes("wallet_balance"), false);
assert.equal(sql.includes("complete_game_load"), false);
assert.equal(sql.includes("request_game_load"), false);
assert.equal(sql.includes("request_auto_game_load"), false);
assert.equal(sql.includes("mark_game_api_debited"), false);
assert.equal(sql.includes("fail_my_stale_game_load"), false);

function holdStale(row) {
  const refunds = body.includes("refund_game_load_wallet") && (row.loadType === "load" || row.loadType === "reload");
  const closes = body.includes("UPDATE") || body.includes("status = 'failed'");
  return {
    returned: closes ? 1 : 0,
    row: {
      ...row,
      status: closes ? "failed" : row.status,
      refunds: refunds ? 1 : row.refunds,
    },
  };
}

const cases = [
  { status: "pending", loadType: "load", error: null, outcome: "pending" },
  { status: "processing", loadType: "reload", error: null, outcome: "processing" },
  { status: "pending", loadType: "load", error: "provider timed out", outcome: "unknown" },
  { status: "processing", loadType: "reload", error: "empty response", outcome: "unknown" },
];

for (const row of cases) {
  const start = { ...row, refunds: 0 };
  const once = holdStale(start);
  const twice = holdStale(once.row);
  assert.equal(once.returned, 0);
  assert.equal(twice.returned, 0);
  assert.equal(twice.row.status, start.status);
  assert.equal(twice.row.refunds, 0);
  assert.equal(twice.row.outcome, start.outcome);
}

const review = readFileSync(
  new URL("../supabase/migrations/20261017000200_hold_stale_game_loads_for_review.sql", import.meta.url),
  "utf8"
);
const reviewBody = review.slice(review.indexOf("AS $$"), review.indexOf("REVOKE ALL"));
assert.match(review, /CREATE OR REPLACE FUNCTION public\.fail_stale_game_loads/);
assert.match(reviewBody, /\[held for review\]/);
assert.match(reviewBody, /FOR UPDATE SKIP LOCKED/);
assert.equal(reviewBody.includes("refund_game_load_wallet"), false);
assert.equal(reviewBody.includes("credit_wallet"), false);
assert.equal(reviewBody.includes("debit_wallet"), false);
assert.equal(reviewBody.includes("wallet_balance"), false);
assert.equal(reviewBody.includes("INSERT"), false);
assert.equal(reviewBody.includes("status = 'failed'"), false);
assert.equal(reviewBody.includes("wallet_refunded = true"), false);
assert.match(review, /GRANT EXECUTE ON FUNCTION public\.fail_stale_game_loads\(integer, uuid, text\) TO service_role/);

console.log("stale load hold checks passed");
