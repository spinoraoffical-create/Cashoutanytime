# KYC security report

Date: 13 October 2026. No production SQL was run. No customer files were listed or moved. Nothing was deployed or pushed.

The live bucket `kyc-documents` is private, limited to 5,242,880 bytes, and limited to JPEG, PNG, WebP, and PDF. The only storage policy returned by the read-only query is `Users can upload deposit proof images`. In source and in that result, that policy is for bucket `chat-attachments`, folder `deposit-proofs`, and the signed-in user's own folder. It does not grant access to `kyc-documents`.

## 1. Confirmed protections

The upload path is a server action. The browser does not talk to the KYC bucket.

- `submitKYCDocument` calls `auth.getUser()` on the player session. A signed-out request stops before any upload.
- The file is uploaded with `createAdminClient()`, which uses the service-role key when that key is set. The service role is how the app writes to a private bucket that has no player storage policy. That is intentional. A public storage policy is not required.
- The storage path is `{signed-in player id}/{random id}.{ext}`. The id comes from the session, not from the form. `upsert` is false, so a player cannot replace another player's object or even their own earlier object by guessing the name.
- `checkKycDataUrl` allows only JPEG, PNG, WebP, and PDF, and rejects anything over 5 MB, before the upload. The bucket repeats those limits.
- If the bucket upload fails, the action does not save the photo as text in the table.
- The audit row stores the file name and the byte count. It does not store the photo or a signed URL. Incident logs store a short error string, not the data URL.
- Review calls `authorize("kyc.manage")` before reading `kyc_submissions` and before `createSignedUrl`. The signed URL lasts 120 seconds. Rows that are already `data:` or `http` are not signed again.
- The review page uses `requirePermission("kyc.manage")`.
- A player status check selects `kyc_status` only. It does not select `document_url` and does not open the bucket.
- Store and sub-creator sessions are sent to the store home before the admin overview queries `kyc_submissions`. Neither role is Super Admin. Neither role has `kyc.manage`, so the review action and the identity-check menu refuse them.
- A normal player is not staff and is not Super Admin, so the same review action refuses them. Table policies in source let a player select only `user_id = auth.uid()` and deny a direct insert. There is no player update or delete policy.
- With no `kyc-documents` storage policy and `public = false`, a player, store, or sub-creator using the anon or authenticated key cannot list or download those objects. The deposit-proof policy does not open this bucket.

## 2. Confirmed vulnerabilities

None that let a store, a sub-creator, or another player read an unrelated ID file.

The admin overview counted pending identity checks for anyone with `cms.manage`. That count is not the photo, and the review page still refused those people. The overview now uses `kyc.manage`, the same permission as the signed URLs.

## 3. Missing permissions

`kyc.manage` is not in the role seed. Super Admin can review because the staff check allows Super Admin without that named permission. A normal admin, manager, store, or sub-creator cannot.

That is closed by default. It is not an extra grant. Do not add a public storage policy to compensate.

## 4. Tests passed and failed

Passed:

- `node scripts/kyc-upload.test.mjs`
- `node scripts/financial-trust.test.mjs`
- `node scripts/staff-access.test.mjs`

The KYC test now refuses review for a customer, a store creator, a sub-creator, an admin who only has `cms.manage`, a manager, and a support agent. It allows Super Admin and an explicit `kyc.manage` grant. It also checks the session user id, `upsert: false`, the 120-second signed URL, the audit fields, and the player status query.

Failed: none.

## 5. Whether SQL changes are necessary

No. The private bucket plus service-role upload is the intended design. Adding a public or authenticated read policy on `kyc-documents` would weaken it.

Live `kyc_submissions` policies were not in the storage query. The source file enables row security, allows a player to read only their own row, and denies a direct insert. Re-read those policies in the SQL editor only if you want that table confirmed live. Do not change them from this report.

## 6. Whether existing KYC documents need migration

No. Files already stored as paths in `kyc-documents` stay in the private bucket. This check did not read or rewrite those files.

Older rows may still store a `data:` URL in `document_url`. The review screen can show that value to a person who already passed `kyc.manage`. Moving those rows would be a data change and is not required to keep the bucket private.

## 7. Whether KYC is ready for production

The document storage design is ready for production: private bucket, no KYC storage policy, service-role upload after a signed-in session, and signed URLs only for `kyc.manage`.

Only Super Admin can review IDs until `kyc.manage` is granted on purpose. Store creators and sub-creators cannot open unrelated documents.

## Files changed

- `src/app/admin/page.tsx` — the pending identity count uses `kyc.manage`.
- `scripts/kyc-upload.test.mjs` — negative authorization checks.
- `KYC_SECURITY_REPORT.md` — this report.
