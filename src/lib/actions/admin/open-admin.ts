"use server";

import { getStaffContext } from "@/lib/data/admin";

/** True only when the existing staff check already allows the admin panel. */
export async function staffCanOpenAdmin(): Promise<boolean> {
  const ctx = await getStaffContext();
  return Boolean(ctx);
}
