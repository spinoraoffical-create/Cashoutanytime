import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { accessFromRoleKeys } from "../src/lib/admin/staff-access.ts";
import { checkKycDataUrl } from "../src/lib/kyc/upload-rules.ts";

function mayReviewKyc(roles, permissions) {
  const access = accessFromRoleKeys(roles);
  return access.isSuperAdmin || permissions.includes("kyc.manage");
}

const png = `data:image/png;base64,${Buffer.from("png-bytes").toString("base64")}`;
assert.equal(checkKycDataUrl(png).ok, true);

assert.equal(checkKycDataUrl("data:text/html;base64,PGh0bWw+").ok, false);
assert.equal(checkKycDataUrl("not-a-file").ok, false);

const huge = `data:image/jpeg;base64,${"A".repeat(8 * 1024 * 1024)}`;
const hugeResult = checkKycDataUrl(huge);
assert.equal(hugeResult.ok, false);

const actions = readFileSync(new URL("../src/lib/actions/kyc-actions.ts", import.meta.url), "utf8");
assert.match(actions, /auth\.getUser\(\)/);
assert.match(actions, /checkKycDataUrl\(docDataUrl\)/);
assert.match(actions, /storagePath = `\$\{user\.id\}\/\$\{crypto\.randomUUID\(\)\}\.\$\{ext\}`/);
assert.match(actions, /\.from\("kyc-documents"\)\.upload/);
assert.equal(actions.includes("getPublicUrl"), false);
assert.match(actions, /createSignedUrl\(row\.document_url, 120\)/);
assert.ok(actions.indexOf('authorize("kyc.manage")') < actions.indexOf("createSignedUrl"));

const page = readFileSync(new URL("../src/app/admin/kyc/page.tsx", import.meta.url), "utf8");
assert.match(page, /requirePermission\("kyc\.manage"\)/);

const bucket = readFileSync(
  new URL("../supabase/migrations/20261013000140_kyc_private_bucket.sql", import.meta.url),
  "utf8"
);
assert.match(bucket, /'kyc-documents',\s*\n\s*false,/);
assert.match(bucket, /5242880/);
assert.match(bucket, /image\/jpeg/);
assert.match(bucket, /application\/pdf/);

const rls = readFileSync(
  new URL("../supabase/migrations/20260720000300_kyc_and_ai_system.sql", import.meta.url),
  "utf8"
);
assert.match(rls, /ENABLE ROW LEVEL SECURITY/);
assert.match(rls, /user_id = auth\.uid\(\)/);
assert.match(rls, /WITH CHECK \(false\)/);
assert.equal(rls.includes("FOR UPDATE"), false);
assert.equal(rls.includes("FOR DELETE"), false);

assert.equal(mayReviewKyc(["customer"], []), false);
assert.equal(mayReviewKyc(["store_creator"], []), false);
assert.equal(mayReviewKyc(["sub_creator"], []), false);
assert.equal(mayReviewKyc(["admin"], ["cms.manage", "users.manage"]), false);
assert.equal(mayReviewKyc(["manager"], ["cms.manage"]), false);
assert.equal(mayReviewKyc(["support_agent"], ["support.manage"]), false);
assert.equal(mayReviewKyc(["admin"], ["kyc.manage"]), true);
assert.equal(mayReviewKyc(["super_admin"], []), true);
assert.equal(accessFromRoleKeys(["store_creator"]).isSuperAdmin, false);
assert.equal(accessFromRoleKeys(["sub_creator"]).isSuperAdmin, false);

const submit = actions.slice(
  actions.indexOf("export async function submitKYCDocument"),
  actions.indexOf("export async function getKYCSystemStatus")
);
assert.ok(submit.indexOf("if (!user)") < submit.indexOf(".upload"));
assert.match(submit, /upsert: false/);
assert.equal(submit.includes('formData.get("user_id")'), false);
const audit = submit.slice(submit.indexOf("after:"), submit.indexOf("revalidatePath"));
assert.match(audit, /document_name: docName/);
assert.match(audit, /bytes: checked\.bytes/);
assert.equal(audit.slice(0, audit.indexOf("})")).includes("docDataUrl"), false);
assert.equal(audit.slice(0, audit.indexOf("})")).includes("document_url"), false);
assert.equal(/logIncident\(\s*"kyc",\s*docDataUrl/.test(submit), false);

const review = actions.slice(
  actions.indexOf("export async function getAdminKYCSubmissions"),
  actions.indexOf("export async function updateKYCStatus")
);
assert.ok(review.indexOf('authorize("kyc.manage")') < review.indexOf('.from("kyc_submissions")'));
assert.match(review, /startsWith\("data:"\)/);
assert.match(review, /startsWith\("http"\)/);

const playerStatus = actions.slice(actions.indexOf("export async function getPlayerKYCStatus"));
assert.match(playerStatus, /\.select\("kyc_status"\)/);
assert.equal(playerStatus.includes("document_url"), false);
assert.equal(playerStatus.includes("kyc-documents"), false);

const dashboard = readFileSync(new URL("../src/app/admin/page.tsx", import.meta.url), "utf8");
assert.match(dashboard, /can\(ctx, "kyc\.manage"\)/);
assert.equal(dashboard.includes('can(ctx, "cms.manage")'), false);
assert.ok(dashboard.indexOf("AgentHome") < dashboard.indexOf("kyc_submissions"));

const adminClient = readFileSync(new URL("../src/lib/supabase/admin.ts", import.meta.url), "utf8");
assert.match(adminClient, /getSupabaseServiceRoleKey\(\)/);

console.log("kyc upload checks passed");
