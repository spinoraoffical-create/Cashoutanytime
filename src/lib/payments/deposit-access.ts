/** Who may read a deposit status. No provider call. */

export function canReadDeposit(input: {
  userId: string;
  providerUserName?: string | null;
  intentUserId?: string | null;
}): boolean {
  const providerUser = input.providerUserName?.trim() || "";
  const intentUser = input.intentUserId?.trim() || "";
  if (providerUser && providerUser !== input.userId) return false;
  if (intentUser && intentUser !== input.userId) return false;
  return Boolean(providerUser || intentUser);
}
