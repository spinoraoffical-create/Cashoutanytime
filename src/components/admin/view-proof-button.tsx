"use client";

import { useState } from "react";
import Image from "next/image";
import { Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  path: string;
  getUrl: (path: string) => Promise<{ url: string } | { error: string }>;
}

export function ViewProofButton({ path, getUrl }: Props) {
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    try {
      const result = await getUrl(path);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        setImageUrl(result.url);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={handleClick} disabled={loading}>
        {loading ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Eye className="size-4" aria-hidden />
        )}
        <span className="sr-only">View payment proof</span>
      </Button>

      <Dialog open={imageUrl !== null} onOpenChange={(open) => !open && setImageUrl(null)}>
        <DialogContent className="max-w-2xl">
          <DialogTitle>Payment proof</DialogTitle>
          {imageUrl && (
            <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-foreground/5">
              <Image
                src={imageUrl}
                alt="Payment proof"
                fill
                className="object-contain"
                sizes="(max-width: 640px) 100vw, 640px"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
