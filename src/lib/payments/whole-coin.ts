/** Games on the playerRecharge API reject a balance that is not a whole number. */
const WHOLE_COIN_GAMES = new Set([
  "cash-frenzy",
  "cash-machine",
  "gameroom",
  "mafia",
  "mr-all-in-one",
]);

export function wholeCoinAmount(slug: string, amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (!WHOLE_COIN_GAMES.has(slug)) return amount;
  return Math.floor(amount);
}
