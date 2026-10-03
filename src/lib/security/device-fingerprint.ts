"use client";

const STORAGE_KEY = "spinora_device_id";
const COOKIE_KEY = "spinora_did";

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function persistDeviceId(id: string) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* private mode */
  }
  try {
    document.cookie = `${COOKIE_KEY}=${encodeURIComponent(id)}; path=/; max-age=31536000; SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

/** Stable browser/device id for multi-account detection (not spoof-proof alone). */
export async function getDeviceId(): Promise<string> {
  if (typeof window === "undefined") return "";

  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached && cached.length >= 16) {
      persistDeviceId(cached);
      return cached;
    }
  } catch {
    /* ignore */
  }

  const parts = [
    navigator.userAgent,
    navigator.language,
    String(screen.width),
    String(screen.height),
    String(screen.colorDepth),
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    String(navigator.hardwareConcurrency ?? 0),
  ].join("|");

  const id = await sha256(parts);
  persistDeviceId(id);
  return id;
}
