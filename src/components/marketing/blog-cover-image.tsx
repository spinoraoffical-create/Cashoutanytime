"use client";

import { useState } from "react";
import Image from "next/image";
import { BookOpen } from "lucide-react";

import { isPhotoCover, isRemoteBlogCover } from "@/lib/blog-cover";
import { cn } from "@/lib/utils";

type BlogCoverImageProps = {
  src: string;
  alt: string;
  priority?: boolean;
  sizes?: string;
  className?: string;
  variant?: "card" | "hero";
};

export function BlogCoverImage({
  src,
  alt,
  priority = false,
  sizes = "(max-width: 640px) 100vw, 33vw",
  className,
  variant = "card",
}: BlogCoverImageProps) {
  const [failed, setFailed] = useState(false);
  const isPhoto = isPhotoCover(src);

  if (failed) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#1a1208] via-[#141414] to-[#0d1a12]">
        <BookOpen className="h-10 w-10 text-white/15" aria-hidden />
      </div>
    );
  }

  const isLocalGame = src.startsWith("/games/");

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0c0c0e]">
      {/* Ambient background glow for game poster art */}
      {isLocalGame && (
        <Image
          src={src}
          alt=""
          fill
          unoptimized
          aria-hidden
          className="object-cover object-center blur-xl opacity-60 scale-125 pointer-events-none"
        />
      )}
      {/* Crisp foreground poster */}
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        unoptimized={isRemoteBlogCover(src)}
        className={cn(
          isLocalGame
            ? "object-contain object-center p-2.5 drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)] transition-transform duration-500 group-hover:scale-105"
            : "object-cover object-center transition-transform duration-500 group-hover:scale-105",
          className
        )}
        onError={() => setFailed(true)}
      />
    </div>
  );

}
