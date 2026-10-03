export interface TocHeading {
  level: number;
  text: string;
  slug: string;
}

export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/**
 * Extracts a heading outline directly from the markdown string (not editor
 * JSON) so both the in-editor TOC and the public blog page — which renders
 * markdown through its own converter, not the editor — agree on the same ids.
 */
export function extractHeadings(markdown: string): TocHeading[] {
  const headings: TocHeading[] = [];
  const seen = new Map<string, number>();
  const lines = markdown.split("\n");

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (!match) continue;
    const level = match[1].length;
    const text = match[2].replace(/[*_`]/g, "").trim();
    if (!text) continue;

    const base = slugifyHeading(text) || "section";
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    const slug = count === 0 ? base : `${base}-${count}`;

    headings.push({ level, text, slug });
  }

  return headings;
}
