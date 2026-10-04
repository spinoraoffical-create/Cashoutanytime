/**
 * User-Friendly Error Formatting for Game Automation & Auto-Fulfillment
 * 
 * Game Vault Status Code Dictionary (Official API Documentation):
 * 0   = Success
 * 1   = Invalid agent ID
 * 2   = Invalid request parameters
 * 3   = Invalid token
 * 4   = Token expired
 * 5   = Access IP is not whitelist IP
 * 6   = Insufficient agent balance
 * 7   = Insufficient user balance
 * 8   = Invalid user ID
 * 9   = User account frozen
 * 10  = User is in game
 * 11  = Invalid amount
 * 12  = Recharge failed
 * 13  = Recharge permission denied
 * 14  = Withdrawal failed
 * 15  = Withdrawal amount exceeds daily limit
 * 16  = Withdrawal under review
 * 17  = Withdrawal permission denied
 * 18  = Account name format error
 * 19  = Agent has no register-user permission
 * 20  = Account name already exists
 * 21  = System failed / System abnormal
 * 22  = Registration IP limit exceeded
 * 23  = Password must be 6-32 characters
 * 400 = Parameter error / System abnormal
 */

export function formatGameAutomationError(
  rawError: any,
  amount?: number | null
): string {
  const msg = (rawError?.message || String(rawError)).trim();
  const code = rawError?.code;

  const amtStr = amount ? ` $${amount.toFixed(2)}` : "";

  if (code === 1 || /code 1\b|invalid agent id/i.test(msg)) {
    return "GameVault rejected the request: Invalid agent ID (code 1).";
  }

  if (code === 2 || /code 2\b|invalid request parameters/i.test(msg)) {
    return "GameVault rejected the request: Invalid request parameters (code 2).";
  }

  if (code === 3 || /code 3\b|invalid token/i.test(msg)) {
    return "GameVault rejected the API token (code 3).";
  }

  if (code === 4 || /code 4\b|token expired/i.test(msg)) {
    return "GameVault API session/token expired (code 4).";
  }

  if (code === 5 || /code 5\b|not white ip|whitelist|access ip/i.test(msg)) {
    return "GameVault rejected the server IP because it is not whitelisted (code 5).";
  }

  if (code === 6 || /code 6\b|insufficient agent balance|insufficient balance/i.test(msg)) {
    return `GameVault agent balance is insufficient (code 6). Your funds have been 100% refunded to your wallet balance.`;
  }

  if (code === 7 || /code 7\b|insufficient user balance/i.test(msg)) {
    return "GameVault user balance is insufficient for this withdrawal (code 7).";
  }

  if (code === 8 || /code 8\b|invalid user id/i.test(msg)) {
    return "GameVault user ID is invalid (code 8).";
  }

  if (code === 9 || /code 9\b|user account frozen|account frozen/i.test(msg)) {
    return "GameVault user account is frozen on provider server (code 9).";
  }

  if (code === 10 || /code 10\b|still in the game|return to the game lobby|user is in game|in game/i.test(msg)) {
    return "Player is currently active inside a game room (code 10). Please exit to game lobby and try again.";
  }

  if (code === 11 || /code 11\b|invalid amount/i.test(msg)) {
    return "GameVault load/redeem amount is invalid (code 11).";
  }

  if (code === 12 || /code 12\b|recharge failed/i.test(msg)) {
    return "GameVault recharge failed (code 12).";
  }

  if (code === 13 || /code 13\b|recharge permission denied/i.test(msg)) {
    return "GameVault agent has no recharge permission (code 13).";
  }

  if (code === 14 || /code 14\b|withdrawal failed/i.test(msg)) {
    return "GameVault withdrawal failed (code 14).";
  }

  if (code === 15 || /code 15\b|withdrawal amount exceeds daily limit/i.test(msg)) {
    return "GameVault withdrawal amount exceeds daily limit (code 15).";
  }

  if (code === 16 || /code 16\b|withdrawal under review/i.test(msg)) {
    return "GameVault withdrawal is under review (code 16).";
  }

  if (code === 17 || /code 17\b|withdrawal permission denied/i.test(msg)) {
    return "GameVault agent has no withdrawal permission (code 17).";
  }

  if (code === 18 || /code 18\b|account name format error/i.test(msg)) {
    return "GameVault rejected the username format (code 18).";
  }

  if (code === 19 || /code 19\b|no register-user permission|no register user permission/i.test(msg)) {
    return "GameVault agent does not have register-user permission (code 19).";
  }

  if (code === 20 || /code 20\b|account name already exists/i.test(msg)) {
    return "GameVault account already exists (code 20).";
  }

  if (code === 21 || code === 400 || /code 21\b|system failed|system is abnormal|abnormal/i.test(msg)) {
    return "GameVault provider returned a system error (code 21 / status 400).";
  }

  if (code === 22 || /code 22\b|number of registration ips exceeds upper limit/i.test(msg)) {
    return "GameVault registration IP limit exceeded (code 22).";
  }

  if (code === 23 || /code 23\b|password must be 6-32 characters|password digits 6 to 32/i.test(msg)) {
    return "GameVault rejected the password format (code 23). Password must be 6-32 characters.";
  }

  return msg;
}
