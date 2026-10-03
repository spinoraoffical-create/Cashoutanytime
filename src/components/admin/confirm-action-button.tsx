"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { AdminActionResult } from "@/lib/actions/admin/core";
import { cn } from "@/lib/utils";

/**
 * Generic confirm-then-run wrapper for a destructive admin action.
 * Pass a bound server action via `action`.
 */
export function ConfirmActionButton({
  action,
  title,
  description,
  confirmLabel = "Confirm",
  triggerLabel,
  icon,
  variant = "destructive",
  redirectTo,
}: {
  action: () => Promise<AdminActionResult>;
  title: string;
  description: string;
  confirmLabel?: string;
  triggerLabel?: string;
  icon?: React.ReactNode;
  variant?: "destructive" | "outline" | "ghost";
  redirectTo?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function run() {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Done");
      setOpen(false);
      if (redirectTo) {
        router.push(redirectTo);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        {triggerLabel ? (
          <Button variant={variant} size="sm">
            {icon ?? <Trash2 className="size-4" aria-hidden />}
            {triggerLabel}
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={title}
            className={cn(variant === "destructive" && "hover:text-ws-danger")}
          >
            {icon ?? <Trash2 className="size-4" aria-hidden />}
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent className="glass-strong">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              run();
            }}
            disabled={pending}
            className="bg-ws-danger/90 text-white hover:bg-ws-danger"
          >
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
