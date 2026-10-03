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

  if (codeLower.includes("redirect") || lower.includes("redirect")) {
    return "Add https://spinoracasinos.com/auth/callback to Supabase → Authentication → URL Configuration → Redirect URLs.";
  }
  if (
    codeLower === "unexpected_failure" ||
    status === 500 ||
    lower.includes("unexpected_failure")
  ) {
    return "Supabase could not send email. Re-check SMTP (smtp.resend.com, user: resend, password: re_ API key) and Confirm signup email template.";
  }
  if (
    status === 504 ||
    lower.includes("retryable") ||
    codeLower.includes("retryable") ||
    (error &&
      typeof error === "object" &&
      (error as { name?: string }).name === "AuthRetryableFetchError")
  ) {
    return "Email send timed out (504). In Supabase SMTP try port 465 instead of 587, save, wait 1 minute, then retry signup. Also use the minimal Confirm signup template.";
  }
  if (!trimmed || trimmed === "{}" || trimmed === code) {
    const details = serializeAuthError(error);
    const hint = code
      ? ` (${code}${status ? `, HTTP ${status}` : ""})`
      : details
        ? ` (${details})`
        : "";
    return `Could not send confirmation email${hint}. Fix Supabase → Authentication → SMTP + Email Templates, then try a new email in incognito.`;
  }

  if (lower.includes("rate limit") || lower.includes("429") || lower.includes("over_email_send_rate_limit")) {
    return "Too many emails sent. Wait about 1 hour, or enable Custom SMTP (Resend) in Supabase → Project Settings → Authentication → SMTP.";
  }
  if (
    lower.includes("confirmation mail") ||
    lower.includes("sending confirmation") ||
    lower.includes("magic link email") ||
    lower.includes("error sending")
  ) {
    return "Could not send email. Check Supabase Custom SMTP (Resend): sender noreply@spinoracasinos.com, API key, and domain verification.";
  }
  if (lower.includes("syntax") || lower.includes("template") || lower.includes("parse")) {
    return 'Email template error in Supabase. Use double braces: {{ .ConfirmationURL }} and {{ .Email }} — not single { }.';
  }
  if (lower.includes("already registered") || lower.includes("already been registered")) {
    return "This email is already registered. Go to Sign In instead.";
  }
  if (code && !trimmed.includes(code)) {
    return `${trimmed} (${code})`;
  }
  return trimmed;
}
