/** Same reply whether or not the email has an account. */
export const RECOVERY_SENT_MESSAGE =
  "If an account uses that email, we sent a 6-digit code. Check the inbox and spam folder.";

export const OTP_REJECTED_MESSAGE = "That code is incorrect or expired. Request a new one.";

const HIDDEN_ACCOUNT_CODES = new Set([
  "user_not_found",
  "user_not_exist",
  "email_not_found",
]);

/** True when the error would tell a stranger that the email is not registered. */
export function shouldHideAccountExistence(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as { message?: string; code?: string };
  const code = (record.code ?? "").toLowerCase();
  if (HIDDEN_ACCOUNT_CODES.has(code)) return true;
  const message = (record.message ?? "").toLowerCase();
  return (
    message.includes("user not found") ||
    message.includes("email not found") ||
    message.includes("no user found") ||
    message.includes("user does not exist")
  );
}
