import assert from "node:assert/strict";

import { checkKycDataUrl } from "../src/lib/kyc/upload-rules.ts";

const png = `data:image/png;base64,${Buffer.from("png-bytes").toString("base64")}`;
assert.equal(checkKycDataUrl(png).ok, true);

assert.equal(checkKycDataUrl("data:text/html;base64,PGh0bWw+").ok, false);
assert.equal(checkKycDataUrl("not-a-file").ok, false);

const huge = `data:image/jpeg;base64,${"A".repeat(8 * 1024 * 1024)}`;
const hugeResult = checkKycDataUrl(huge);
assert.equal(hugeResult.ok, false);

console.log("kyc upload checks passed");
