const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const AGE_REQUIRED = "You must be 18 or older.";

function calendarDate(value: string | null | undefined): { year: number; month: number; day: number } | null {
  const match = ISO_DATE.exec((value || "").trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) return null;
  return { year, month, day };
}

export function ageDenial(value: string | null | undefined, today = new Date()): string | null {
  const born = calendarDate(value);
  if (!born) return AGE_REQUIRED;
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth() + 1;
  const day = today.getUTCDate();
  let age = year - born.year;
  if (month < born.month || (month === born.month && day < born.day)) age -= 1;
  if (age < 18) return AGE_REQUIRED;
  return null;
}
