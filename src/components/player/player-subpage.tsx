"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { MotionPage } from "@/components/player/motion-page";

export function PlayerSubpage({
  title,
  subtitle,
  back = "/dashboard",
  children,
}: {
  title: string;
  subtitle?: string;
  back?: string;
  children: React.ReactNode;
}) {
  return (
    <MotionPage className="space-y-5">
      <Link href={back} className="inline-flex items-center gap-1 text-sm font-semibold text-zinc-300">
        <ChevronLeft className="h-4 w-4" /> Back
      </Link>
      <div>
        <h1 className="text-3xl font-extrabold">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-zinc-400">{subtitle}</p> : null}
      </div>
      {children}
    </MotionPage>
  );
}
