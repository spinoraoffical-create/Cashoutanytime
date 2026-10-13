/** Pure rules for automation health. No database and no outbound calls. */

export type JobHealth = "off" | "not_scheduled" | "unknown" | "stale" | "ok";

export type JobSignal = {
  scheduled: boolean;
  switchOn: boolean | null;
  lastRunAt: string | null;
  expectedEveryHours: number | null;
  now: Date;
};

export function classifyJob(input: JobSignal): JobHealth {
  if (input.switchOn === false) return "off";
  if (!input.scheduled) return "not_scheduled";
  if (!input.lastRunAt || !input.expectedEveryHours) return "unknown";
  const last = new Date(input.lastRunAt).getTime();
  if (Number.isNaN(last)) return "unknown";
  const ageHours = (input.now.getTime() - last) / 3_600_000;
  if (ageHours > input.expectedEveryHours * 1.5) return "stale";
  return "ok";
}

export function healthLabel(health: JobHealth): string {
  if (health === "off") return "Switch off";
  if (health === "not_scheduled") return "Not on the Vercel schedule";
  if (health === "unknown") return "Last run is not stored";
  if (health === "stale") return "Last run is late";
  return "Within the expected window";
}

/** Cash outs a person must look at. This list is not a retry. */
export function needsPersonPayout(status: string | null, providerStatus: string | null): boolean {
  if (status !== "reserved" && status !== "submitted") return false;
  return !providerStatus?.trim();
}
