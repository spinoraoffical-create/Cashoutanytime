import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { accessFromRoleKeys } from "../src/lib/admin/staff-access.ts";

const player = accessFromRoleKeys([]);
assert.equal(player.isStaff, false);
assert.equal(player.isSuperAdmin, false);

const profileAdminIgnored = accessFromRoleKeys([]);
assert.equal(profileAdminIgnored.isStaff, false);

const customerRow = accessFromRoleKeys(["customer"]);
assert.equal(customerRow.isStaff, false);
assert.equal(customerRow.isSuperAdmin, false);

const owner = accessFromRoleKeys(["super_admin"]);
assert.equal(owner.isStaff, true);
assert.equal(owner.isSuperAdmin, true);

for (const key of ["admin", "manager", "support_agent", "moderator"]) {
  const staff = accessFromRoleKeys([key]);
  assert.equal(staff.isStaff, true);
  assert.equal(staff.isSuperAdmin, false);
}

const adminSource = readFileSync(new URL("../src/lib/data/admin.ts", import.meta.url), "utf8");
assert.equal(adminSource.includes("legacyAdminContext"), false);
assert.equal(adminSource.includes("profiles.role"), false);
assert.equal(adminSource.includes('roles: ["super_admin"]'), false);

const signup = readFileSync(
  new URL("../supabase/migrations/20261008000140_customer_signup_role.sql", import.meta.url),
  "utf8"
);
assert.match(signup, /'customer'/);
assert.equal(signup.includes("insert into public.user_roles"), false);

console.log("staff access checks passed");
