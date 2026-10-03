import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

/** Popular codes shown as hints only — any valid E.164 number is accepted. */
export const PHONE_EXAMPLES = [
  "+1 555 123 4567",
  "+44 7911 123456",
  "+91 98765 43210",
  "+971 50 123 4567",
  "+61 412 345 678",
  "+49 151 23456789",
  "+234 801 234 5678",
  "+92 300 1234567",
  "+880 1712 345678",
  "+81 90 1234 5678",
  "+55 11 91234 5678",
  "+52 55 1234 5678",
];

export const INVALID_PHONE_MESSAGE =
  "Enter a valid phone number for your country";

export type ParsePhoneOptions = {
  /** ISO 3166-1 alpha-2 when parsing national format (e.g. NP, US) */
  countryIso?: string;
  /** Require libphonenumber isValid() — use for signup and profile saves */
  validate?: boolean;
};

function asCountryCode(iso: string | undefined): CountryCode | undefined {
  if (!iso || !/^[A-Z]{2}$/i.test(iso)) return undefined;
  return iso.toUpperCase() as CountryCode;
}

function parsePhoneInput(input: string, defaultCountry?: CountryCode) {
  const trimmed = input.trim();
  if (!trimmed) return null;

  try {
    const parsed = parsePhoneNumberFromString(trimmed, defaultCountry);
    if (parsed) return parsed;

    if (!trimmed.startsWith("+")) {
      const digits = trimmed.replace(/\D/g, "");
      if (digits) {
        return parsePhoneNumberFromString(digits, defaultCountry) ?? null;
      }
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Parse phone input into E.164 (+XXXXXXXX).
 * With validate: true, rejects numbers that fail libphonenumber country rules.
 */
export function parseInternationalPhone(
  input: string,
  options?: ParsePhoneOptions
): string | null {
  const defaultCountry = asCountryCode(options?.countryIso);
  const parsed = parsePhoneInput(input, defaultCountry);
  if (!parsed) return null;

  if (options?.validate && !parsed.isValid()) return null;

  return parsed.format("E.164");
}

/** Signup / profile save — strict libphonenumber validation */
export function parseValidInternationalPhone(
  input: string,
  countryIso?: string
): string | null {
  return parseInternationalPhone(input, { countryIso, validate: true });
}

/** Country dropdown + local digits — strict validation for signup */
export function phoneFromParts(countryIso: string, localNumber: string): string | null {
  return parseValidInternationalPhone(localNumber, countryIso);
}

/** @deprecated Use phoneFromParts — kept for split-field fallback */
export function formatPhoneToE164(
  countryCode: string,
  localNumber: string,
  countryIso?: string
): string | null {
  const local = localNumber.trim();
  if (local.startsWith("+")) {
    return parseInternationalPhone(local, { countryIso, validate: true });
  }

  if (countryIso) {
    return parseValidInternationalPhone(local, countryIso);
  }

  const codeDigits = countryCode.replace(/\D/g, "");
  const localDigits = local.replace(/\D/g, "");
  if (!codeDigits || localDigits.length < 4) return null;

  return parseValidInternationalPhone(`+${codeDigits}${localDigits}`);
}

export function isValidOtpCode(code: string): boolean {
  return /^\d{6}$/.test(code.trim());
}

export function formatPhoneDisplay(e164: string): string {
  if (!e164.startsWith("+")) return e164;
  const digits = e164.slice(1);
  if (digits.length <= 4) return e164;
  return `+${digits.slice(0, 3)} ${digits.slice(3)}`;
}

/** E.164 plus common stored variants (+977..., 977..., etc.) */
export function phoneLookupVariants(input: string): string[] {
  const parsed = parseInternationalPhone(input);
  if (!parsed) return [];

  const digits = parsed.replace(/\D/g, "");
  return [...new Set([parsed, `+${digits}`, digits])];
}
