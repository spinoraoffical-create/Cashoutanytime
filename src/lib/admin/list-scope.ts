export type AdminListDecision =
  | { mode: "all" }
  | { mode: "network"; parentIds: string[] }
  | { mode: "deny" };

const KNOWN_LEVELS = new Set(["platform", "store", "sub"]);

function validParentIds(parentIds: unknown): parentIds is string[] {
  return (
    Array.isArray(parentIds) &&
    parentIds.length > 0 &&
    parentIds.every((id) => typeof id === "string" && id.length > 0)
  );
}

/**
 * Store and sub-creator rows win over staff permissions.
 * A missing or unrecognized scope does not fall through to every row.
 * A Super Admin whose scope resolved as platform still sees every row.
 * A staff account that is confirmed not to be a store or sub keeps that page's existing full list.
 */
export function adminListScope(input: {
  isSuperAdmin: boolean;
  hasStaffPermission: boolean;
  scopeStatus: "ok" | "missing" | "unavailable";
  scope: { level: string; parentIds: string[] } | null;
}): AdminListDecision {
  if (input.scopeStatus !== "ok") return { mode: "deny" };

  const scope = input.scope;
  if (scope && (scope.level === "store" || scope.level === "sub")) {
    if (!validParentIds(scope.parentIds)) return { mode: "deny" };
    return { mode: "network", parentIds: scope.parentIds };
  }

  if (scope?.level === "platform" && input.isSuperAdmin) return { mode: "all" };

  if (scope && !KNOWN_LEVELS.has(scope.level)) return { mode: "deny" };

  if (!scope && input.hasStaffPermission && !input.isSuperAdmin) return { mode: "all" };

  return { mode: "deny" };
}

/** PostgREST treats an empty `in` list as unbounded. An unused id matches nothing. */
export const UNMATCHED_SCOPE_ID = "00000000-0000-0000-0000-000000000000";

export function idsOrNone(ids: readonly string[]) {
  return ids.length ? [...ids] : [UNMATCHED_SCOPE_ID];
}
