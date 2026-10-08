/** Staff keys that may open /admin. Profile role and email never count. */
export const STAFF_ROLE_KEYS = [
  "super_admin",
  "admin",
  "manager",
  "support_agent",
  "moderator",
] as const;

export type StaffRoleKey = (typeof STAFF_ROLE_KEYS)[number];

export function accessFromRoleKeys(roleKeys: readonly string[]) {
  const roles = roleKeys.filter((key): key is StaffRoleKey =>
    (STAFF_ROLE_KEYS as readonly string[]).includes(key)
  );
  return {
    roles,
    isStaff: roles.length > 0,
    isSuperAdmin: roles.includes("super_admin"),
  };
}
