"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center text-white">
      <h1 className="text-xl font-bold">This page hit a problem</h1>
      <p className="max-w-sm text-sm text-zinc-400">Try again. Your wallet was not changed by this error.</p>
      <div className="flex gap-3">
        <Button onClick={() => reset()}>Try again</Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard">Back to home</Link>
        </Button>
      </div>
    </div>
  );
}
