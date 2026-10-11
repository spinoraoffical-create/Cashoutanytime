import Image from "next/image";

function usesNextImage(src: string) {
  if (src.startsWith("/")) return true;
  try {
    const host = new URL(src).hostname;
    return host.endsWith(".supabase.co") || host === "images.pexels.com";
  } catch {
    return false;
  }
}

/** Game art from the catalog. Local and known hosts stay on next/image. Any other host uses a plain image so one bad URL cannot crash the page. */
export function GameArt({
  src,
  alt = "",
  className = "object-cover",
  priority = false,
  sizes,
}: {
  src: string;
  alt?: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
}) {
  const picture = src || "/logo.webp";
  if (!usesNextImage(picture)) {
    return <img src={picture} alt={alt} className={`absolute inset-0 h-full w-full ${className}`} />;
  }
  return <Image src={picture} alt={alt} fill className={className} priority={priority} sizes={sizes} />;
}
