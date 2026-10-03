/** Panel rejects taken / globally similar login names. */
export const DUPLICATE_USERNAME_RE =
  /exist|already|taken|duplicate|repeat|in ?use|have used|used|same name|similar|too close|登录名|重复|已存在/i;

/** Username variants to try (plain + padded + next numbers). */
export const CREATE_ACCOUNT_MAX_ATTEMPTS = 36;
