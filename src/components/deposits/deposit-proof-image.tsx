"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { getChatAttachmentSignedUrl } from "@/lib/chat/attachments";
import { isDepositProofStoragePath } from "@/lib/deposits/proof-upload";

interface DepositProofImageProps {
  path: string;
  alt?: string;
  className?: string;
}

export function DepositProofImage({
  path,
  alt = "Deposit proof screenshot",
  className,
}: DepositProofImageProps) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (path.startsWith("http://") || path.startsWith("https://")) {
        setSrc(path);
        return;
      }

      if (!isDepositProofStoragePath(path)) {
        setSrc(null);
        return;
      }

      const supabase = createClient();
      if (!supabase) return;

      const signed = await getChatAttachmentSignedUrl(supabase, path, 3600);
      if (!cancelled) setSrc(signed);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (!src) {
    return (
      <div
        className={`h-40 w-full max-w-sm rounded-lg bg-white/5 animate-pulse border border-white/10 ${className ?? ""}`}
      />
    );
  }

  return (
    <a href={src} target="_blank" rel="noopener noreferrer" className={`block max-w-sm ${className ?? ""}`}>
      <div className="relative h-40 w-full rounded-lg overflow-hidden border border-white/10 hover:border-orange-500/40 transition-colors">
        <Image src={src} alt={alt} fill className="object-contain bg-black/40" unoptimized />
      </div>
      <span className="text-[10px] text-orange-400 mt-1 inline-block hover:underline">
        Open full screenshot
      </span>
    </a>
  );
}
