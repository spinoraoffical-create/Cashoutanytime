const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

const CHANNELS = {
  finance: process.env.TELEGRAM_CHAT_FINANCE,
  users: process.env.TELEGRAM_CHAT_USERS,
  sweepstakes: process.env.TELEGRAM_CHAT_SWEEPSTAKES,
  errors: process.env.TELEGRAM_CHAT_ERRORS,
  reports: process.env.TELEGRAM_CHAT_REPORTS,
} as const;

type Channel = keyof typeof CHANNELS;

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://spinoracasinos.com";

/** Escape user-supplied strings for Telegram HTML parse_mode. */
export function tgEsc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Clickable admin link for Telegram HTML messages. */
export function adminLink(path: string, label: string): string {
  return `<a href="${SITE}${path}">${label}</a>`;
}

async function tgPost(
  method: string,
  body: BodyInit,
  headers?: Record<string, string>
): Promise<{ ok: boolean; description?: string }> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
      method: "POST",
      headers,
      body,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      return { ok: false, description: data?.description ?? `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, description: err instanceof Error ? err.message : "network error" };
  }
}

export async function tgNotify(channel: Channel, text: string): Promise<void> {
  const chatId = CHANNELS[channel];
  if (!TOKEN || !chatId) return;
  const result = await tgPost(
    "sendMessage",
    JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    { "Content-Type": "application/json" }
  );
  if (!result.ok) {
    console.error(`[telegram] tgNotify(${channel}) failed: ${result.description}`);
    if (channel !== "errors") {
      await tgNotify(
        "errors",
        `🚨 <b>Telegram send failed</b> (channel: ${tgEsc(channel)})\n${tgEsc(result.description ?? "unknown error")}`
      );
    }
  }
}

export async function tgNotifyPhoto(
  channel: Channel,
  caption: string,
  photo: { data: ArrayBuffer; filename: string; contentType: string }
): Promise<void> {
  const chatId = CHANNELS[channel];
  if (!TOKEN || !chatId) return;
  const form = new FormData();
  form.set("chat_id", chatId);
  form.set("caption", caption);
  form.set("parse_mode", "HTML");
  form.set("photo", new Blob([photo.data], { type: photo.contentType }), photo.filename);
  const result = await tgPost("sendPhoto", form);
  if (!result.ok) {
    console.error(`[telegram] tgNotifyPhoto(${channel}) failed: ${result.description}`);
    if (channel !== "errors") {
      await tgNotify(
        "errors",
        `🚨 <b>Telegram photo send failed</b> (channel: ${tgEsc(channel)})\n${tgEsc(result.description ?? "unknown error")}`
      );
    }
  }
}
