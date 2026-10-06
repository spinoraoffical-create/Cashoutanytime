import { parseInternationalPhone } from "@/lib/auth/phone";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmailIdentifier(input: string): boolean {
  return EMAIL_RE.test(input.trim().toLowerCase());
}

export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

/** Parse login/register identifier — email or E.164 phone */
export function parseLoginIdentifier(input: string): { type: "email"; value: string } | { type: "phone"; value: string } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (isEmailIdentifier(trimmed)) {
    return { type: "email", value: normalizeEmail(trimmed) };
  }

  const phone = parseInternationalPhone(trimmed);
  if (phone) return { type: "phone", value: phone };

  return null;
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
}

/** Friendlier Supabase auth errors for OTP flows */
function serializeAuthError(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  try {
    const e = error as Record<string, unknown>;
    return Object.entries(e)
      .filter(([, v]) => v != null && v !== "" && typeof v !== "function")
      .map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
      .join(", ");
  } catch {
    return "";
  }
}

export function formatAuthErrorMessage(error: unknown): string {
  let message = "";
  let code = "";
  let status: number | undefined;

  if (typeof error === "string") {
    message = error;
  } else if (error && typeof error === "object") {
    const e = error as {
      message?: string;
      msg?: string;
      error_description?: string;
      code?: string;
      status?: number;
    };
    message = e.message || e.msg || e.error_description || "";
    code = e.code ?? "";
    status = e.status;
    if (!message && code) message = code;
  }

  const trimmed = message.trim();
  const lower = trimmed.toLowerCase();
  const codeLower = code.toLowerCase();

  if (
    codeLower === "invalid_credentials" ||
    lower.includes("invalid login credentials") ||
    lower.includes("invalid email or password")
  ) {
    return "Email or password is incorrect. If you just created an account, open the confirmation email before signing in.";
  }
  if (codeLower.includes("redirect") || lower.includes("redirect")) {
    console.error("[auth] redirect rejected:", trimmed, code);
    return "Sign-in could not finish. Please try again, or contact support.";
  }
  if (
    codeLower === "unexpected_failure" ||
    status === 500 ||
    lower.includes("unexpected_failure")
  ) {
    console.error("[auth] unexpected failure:", trimmed, code);
    return "We couldn't send the email. Wait a few minutes and try again, or contact support.";
  }
  if (
    status === 504 ||
    lower.includes("retryable") ||
    codeLower.includes("retryable") ||
    (error &&
      typeof error === "object" &&
      (error as { name?: string }).name === "AuthRetryableFetchError")
  ) {
    return "The email is taking too long to send. Wait a minute and try again.";
  }
  if (!trimmed || trimmed === "{}" || trimmed === code) {
    const details = serializeAuthError(error);
    console.error("[auth] empty auth error:", details || code || status);
    return "We couldn't send the confirmation email. Wait a few minutes and try again, or contact support.";
  }

  if (lower.includes("rate limit") || lower.includes("429") || lower.includes("over_email_send_rate_limit")) {
    return "Too many emails were sent. Wait about an hour, then try again.";
  }
  if (
    lower.includes("confirmation mail") ||
    lower.includes("sending confirmation") ||
    lower.includes("magic link email") ||
    lower.includes("error sending")
  ) {
    return "We couldn't send the email. Wait a few minutes and try again, or contact support.";
  }
  if (lower.includes("syntax") || lower.includes("template") || lower.includes("parse")) {
    console.error("[auth] template error:", trimmed);
    return "We couldn't send the email. Please contact support.";
  }
  if (lower.includes("already registered") || lower.includes("already been registered")) {
    return "This email is already registered. Go to Sign In instead.";
  }
  if (isSensitivePlayerAuthError(trimmed)) {
    console.error("[auth]", trimmed, code);
    return "Something went wrong. Please try again, or contact support.";
  }
  return trimmed;
}

function isSensitivePlayerAuthError(message: string): boolean {
  return /supabase|smtp|api[_ -]?key|process\.env|not configured|sql editor/i.test(message);
}
