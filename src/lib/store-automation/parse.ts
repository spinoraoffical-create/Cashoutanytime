import { confirmedCheckBalance } from "../game-automation/load-outcome";
import type { GameRecordRow } from "./types";

/** A blank or non-numeric value is unknown. The number 0 stays 0. */
export function parseStoreBalance(raw: unknown): number | null {
  if (typeof raw === "number") return confirmedCheckBalance(raw);
  if (typeof raw === "string") {
    const text = raw.trim();
    if (!text) return null;
    return confirmedCheckBalance(Number(text));
  }
  return null;
}

export function parseGameRecords(raw: unknown): GameRecordRow[] | null {
  if (!Array.isArray(raw)) return null;
  const rows: GameRecordRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const row = item as { id?: unknown; kind?: unknown; amount?: unknown };
    const id = typeof row.id === "string" ? row.id.trim() : "";
    const kind = row.kind === "load" || row.kind === "redeem" || row.kind === "play" ? row.kind : null;
    const amount = parseStoreBalance(row.amount);
    if (!id || !kind || amount === null) return null;
    rows.push({ id, kind, amount });
  }
  return rows;
}

export function sameMoney(left: number | null, right: number | null): boolean {
  if (left === null || right === null) return false;
  return Math.abs(left - right) <= 0.001;
}
