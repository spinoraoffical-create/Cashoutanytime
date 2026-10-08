export type OwnedGameAccount = {
  userId: string;
  gameSlug: string;
  username: string;
};

/** The destination account is the signed-in player's row. A typed username is ignored. */
export function usernameForOwner(
  accounts: readonly OwnedGameAccount[],
  userId: string,
  gameSlug: string
): { username: string } | { error: "Account not found" } {
  const row = accounts.find(
    (account) => account.userId === userId && account.gameSlug === gameSlug && account.username.trim().length > 0
  );
  if (!row) return { error: "Account not found" };
  return { username: row.username };
}
