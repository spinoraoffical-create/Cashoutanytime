import { after } from "next/server";

/** Short id for an admin log line. Do not pass secrets or document bytes. */

export function incidentCode(): string {
  return `inc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function logIncident(area: string, message: string, options?: { telegram?: boolean }): string {
  const id = incidentCode();
  const safe = message.replace(/\s+/g, " ").slice(0, 180);
  console.error(`[${area}] ${id} ${safe}`);
  if (options?.telegram !== false) {
    const task = () =>
      import("@/lib/telegram/control/delivery")
        .then(({ enqueueIncident }) =>
          enqueueIncident({
            source: area,
            code: id,
            outcome: area === "audit" ? "audit" : "failed",
            adminPath: "/admin/telegram-center",
          })
        )
        .catch(() => undefined);
    try {
      after(task);
    } catch {
      void task();
    }
  }
  return id;
}
