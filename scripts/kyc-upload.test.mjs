import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { checkKycDataUrl } from "../src/lib/kyc/upload-rules.ts";

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

console.log("kyc upload checks passed");
