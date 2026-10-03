/** Shared by the editor's video-embed node and the public blog renderer. */
export function toVideoEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");

    if (host === "youtube.com" || host === "m.youtube.com") {
      const id = u.searchParams.get("v");
      if (id) return `https://www.youtube-nocookie.com/embed/${id}`;
      const shorts = u.pathname.match(/^\/shorts\/([\w-]+)/);
      if (shorts) return `https://www.youtube-nocookie.com/embed/${shorts[1]}`;
    }
    if (host === "youtu.be") {
      const id = u.pathname.slice(1);
      if (id) return `https://www.youtube-nocookie.com/embed/${id}`;
    }
    if (host === "vimeo.com") {
      const id = u.pathname.match(/^\/(\d+)/)?.[1];
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
    return null;
  } catch {
    return null;
  }
}
