import { SITE_URL } from "@/lib/constants";

/** Public IndexNow key. The matching text file must stay at /{key}.txt. */
export const INDEXNOW_KEY = "sweeptakehub7f3a9c2e1b8d4";

export async function submitIndexNow(urls: string[]) {
  const host = new URL(SITE_URL).host;
  const unique = [...new Set(urls.map((url) => url.trim()))]
    .filter((url) => {
      try {
        return new URL(url).host === host;
      } catch {
        return false;
      }
    })
    .slice(0, 10000);

  if (unique.length === 0) {
    return { ok: false as const, submitted: 0, status: 0, error: "No public URLs to submit." };
  }

  const response = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host,
      key: INDEXNOW_KEY,
      keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
      urlList: unique,
    }),
  });

  return {
    ok: response.ok || response.status === 202,
    submitted: unique.length,
    status: response.status,
    error: response.ok || response.status === 202 ? undefined : await response.text(),
  };
}
