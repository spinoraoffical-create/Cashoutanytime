/** Display timezone for the owner. Stored instants stay UTC. Nepal has no daylight saving. */
export const NEPAL_TIME_ZONE = "Asia/Kathmandu";
export const NEPAL_OFFSET_MINUTES = 5 * 60 + 45;
export const NEPAL_TIME_NOTE = "All times shown in Nepal Time (NPT, UTC+05:45).";

const WALL_CLOCK = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;

export function formatNepalTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: NEPAL_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const hour = pick("hour");
  const minute = pick("minute");
  const dayPeriod = pick("dayPeriod").toUpperCase();
  return `${pick("day")} ${pick("month")} ${pick("year")}, ${hour}:${minute} ${dayPeriod} NPT`;
}

/** Value for a datetime-local input, as a Nepal wall clock. */
export function formatNepalInputValue(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: NEPAL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")}T${pick("hour")}:${pick("minute")}`;
}

/**
 * Read a datetime-local value as Nepal wall-clock time and return the UTC instant.
 * A value that already has a timezone offset is parsed as that instant, not shifted again.
 */
export function parseNepalLocalToUtc(local: string | null | undefined): Date | null {
  const raw = (local || "").trim();
  if (!raw) return null;
  if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(raw)) {
    const dated = new Date(raw);
    return Number.isNaN(dated.getTime()) ? null : dated;
  }
  const match = WALL_CLOCK.exec(raw);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  const utc = Date.UTC(year, month - 1, day, hour, minute) - NEPAL_OFFSET_MINUTES * 60 * 1000;
  const date = new Date(utc);
  return Number.isNaN(date.getTime()) ? null : date;
}
