"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { retryFailedLoadAction } from "@/lib/actions/auto-ops";
import { Button } from "@/components/ui/button";

export function RetryLoadButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      disabled={busy}
      onClick={() => {
        if (!window.confirm("Retry this game load? The deposit will not be credited again.")) return;
        setBusy(true);
        void retryFailedLoadAction(requestId).then((result) => {
          setBusy(false);
          if (!result.ok) toast.error(result.error ?? "Retry failed.");
          else {
            toast.success(result.message ?? "Retried.");
            router.refresh();
          }
        });
      }}
    >
      Retry load
    </Button>
  );
}
