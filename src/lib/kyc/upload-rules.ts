const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
export const KYC_MAX_BYTES = 5 * 1024 * 1024;

export type KycFileCheck =
  | { ok: true; mime: string; bytes: number }
  | { ok: false; error: string };

export function checkKycDataUrl(dataUrl: string): KycFileCheck {
  const match = /^data:([^;,]+);base64,([a-z0-9+/=\s]+)$/i.exec(dataUrl.trim());
  if (!match) return { ok: false, error: "Upload a JPEG, PNG, WebP, or PDF." };
  const mime = match[1].toLowerCase();
  if (!ALLOWED.has(mime)) return { ok: false, error: "Upload a JPEG, PNG, WebP, or PDF." };
  const payload = match[2].replace(/\s/g, "");
  const bytes = Math.floor((payload.length * 3) / 4) - (payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0);
  if (bytes <= 0) return { ok: false, error: "That file is empty." };
  if (bytes > KYC_MAX_BYTES) return { ok: false, error: "That file is larger than 5 MB." };
  return { ok: true, mime, bytes };
}
