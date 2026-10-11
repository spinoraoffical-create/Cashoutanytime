export type ScoreRow = { score?: number | null };

export type LiveGameBalance = {
  slug: string;
  name: string;
  storeCoins: number | null;
  playerCoins: number | null;
  playerCount: number | null;
  partial: boolean;
  status: "live" | "not_connected" | "error";
  detail: string | null;
};

export const PLAYER_PAGE_SIZE = 100;
export const PLAYER_PAGE_CAP = 15;

export function sumPlayerScores(rows: ScoreRow[]): number {
  let total = 0;
  for (const row of rows) {
    const score = Number(row.score);
    if (Number.isFinite(score)) total += score;
  }
  return total;
}

export function coinText(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

export function playerListFinished(input: {
  page: number;
  rowCount: number;
  seen: number;
  total: number | null;
}): boolean {
  if (input.rowCount === 0) return true;
  if (input.rowCount < PLAYER_PAGE_SIZE) return true;
  if (input.total != null && input.seen >= input.total) return true;
  return input.page >= PLAYER_PAGE_CAP;
}
