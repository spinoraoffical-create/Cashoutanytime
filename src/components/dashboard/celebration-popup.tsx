"use client";

import { toast } from "sonner";

export function celebrate(opts: { type: string; title: string; detail?: string }) {
  toast.success(opts.title, { description: opts.detail });
}
