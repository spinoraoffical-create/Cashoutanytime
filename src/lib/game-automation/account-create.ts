/** Load types that provision a game login (initial create or replace). */
export const GAME_ACCOUNT_CREATE_LOAD_TYPES = ["create_account", "new_account"] as const;

export function isGameAccountCreateLoadType(loadType: string): boolean {
  return (GAME_ACCOUNT_CREATE_LOAD_TYPES as readonly string[]).includes(loadType);
}
