"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Check, AlertCircle, CloudOff } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { AdminActionResult } from "@/lib/actions/admin/core";
import {
  createImageUploadAdapter,
  type ImageUploadAction,
} from "@/components/editor/adapters/supabase-image-upload";
import { useAutosave } from "@/lib/hooks/use-autosave";

// Lazy: only the CMS blog editor uses a "richtext" field. Every other admin
// dialog (rewards, achievements, VIP, games, etc.) was paying for the full
// TipTap/ProseMirror bundle without ever rendering it.
const RichContentEditor = dynamic(
  () => import("@/components/editor/rich-content-editor").then((m) => m.RichContentEditor),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[24rem] animate-pulse rounded-lg border border-border bg-foreground/5" />
    ),
  }
);
const SeoPanel = dynamic(
  () => import("@/components/editor/seo-panel").then((m) => m.SeoPanel),
  { ssr: false }
);

export type FieldValue = string | number | boolean;

export type FieldDef =
  | {
      name: string;
      label: string;
      type: "text" | "number" | "textarea" | "datetime-local";
      defaultValue: string | number;
      min?: number;
      step?: number;
      hint?: string;
    }
  | { name: string; label: string; type: "switch"; defaultValue: boolean }
  | { name: string; label: string; type: "select"; defaultValue: string; options: { value: string; label: string }[] }
  | {
      name: string;
      label: string;
      type: "richtext";
      defaultValue: string;
      onUploadImage?: ImageUploadAction;
      withSeoPanel?: boolean;
    };

/**
 * Generic edit dialog: renders a field set and submits a Record of values to a
 * bound server action. Reused by rewards, achievements and VIP tier editors.
 */
export function EntityEditDialog({
  title,
  fields,
  action,
  triggerLabel,
  dialogClassName,
  enableAutosave,
}: {
  title: string;
  fields: FieldDef[];
  action: (values: Record<string, FieldValue>) => Promise<AdminActionResult>;
  triggerLabel?: string;
  dialogClassName?: string;
  /** Debounced background save via the same `action` — only safe when `action` always updates an existing row (never inserts). */
  enableAutosave?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [values, setValues] = React.useState<Record<string, FieldValue>>(() =>
    Object.fromEntries(fields.map((f) => [f.name, f.defaultValue]))
  );

  // re-seed when reopened (defaults may have changed after a refresh)
  React.useEffect(() => {
    if (open) {
      setValues(Object.fromEntries(fields.map((f) => [f.name, f.defaultValue])));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const autosave = React.useCallback(
    async (v: Record<string, FieldValue>) => {
      if (!enableAutosave || !open) return;
      const result = await action(v);
      if (!result.ok) throw new Error(result.error);
    },
    [enableAutosave, open, action]
  );
  const autosaveStatus = useAutosave(values, autosave);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await action(values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Saved");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerLabel ? (
          <Button variant="outline" size="sm">
            <Pencil className="size-4" aria-hidden />
            {triggerLabel}
          </Button>
        ) : (
          <Button variant="ghost" size="icon-sm" aria-label={title}>
            <Pencil className="size-4" aria-hidden />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        className={cn(
          "glass-strong w-[min(calc(100vw-1.5rem),100%)] max-h-[90dvh] overflow-y-auto sm:max-w-lg",
          dialogClassName
        )}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {fields.map((field) => (
            <div key={field.name} className="space-y-2">
              {field.type === "switch" ? (
                <label className="flex items-center justify-between gap-4">
                  <span className="text-sm font-medium">{field.label}</span>
                  <Switch
                    checked={Boolean(values[field.name])}
                    onCheckedChange={(v) =>
                      setValues((prev) => ({ ...prev, [field.name]: v }))
                    }
                    aria-label={field.label}
                  />
                </label>
              ) : field.type === "select" ? (
                <>
                  <Label htmlFor={`f-${field.name}`}>{field.label}</Label>
                  <Select
                    value={String(values[field.name] ?? "")}
                    onValueChange={(v) =>
                      setValues((prev) => ({ ...prev, [field.name]: v }))
                    }
                  >
                    <SelectTrigger id={`f-${field.name}`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {field.options.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              ) : field.type === "textarea" ? (
                <>
                  <Label htmlFor={`f-${field.name}`}>{field.label}</Label>
                  <Textarea
                    id={`f-${field.name}`}
                    rows={3}
                    value={String(values[field.name] ?? "")}
                    onChange={(e) =>
                      setValues((prev) => ({ ...prev, [field.name]: e.target.value }))
                    }
                  />
                </>
              ) : field.type === "richtext" ? (
                <div className={cn("grid gap-4", field.withSeoPanel && "lg:grid-cols-[1fr_260px]")}>
                  <div className="min-w-0 space-y-2">
                    <Label>{field.label}</Label>
                    <div className="rounded-lg border border-border bg-background">
                      <RichContentEditor
                        content={String(values[field.name] ?? "")}
                        onChange={(markdown) =>
                          setValues((prev) => ({ ...prev, [field.name]: markdown }))
                        }
                        onUploadImage={
                          field.onUploadImage ? createImageUploadAdapter(field.onUploadImage) : undefined
                        }
                        className="min-h-[24rem]"
                      />
                    </div>
                  </div>
                  {field.withSeoPanel && (
                    <SeoPanel
                      content={String(values[field.name] ?? "")}
                      title={String(values.title ?? "")}
                      slug={String(values.slug ?? "")}
                      seoTitle={String(values.seo_title ?? "")}
                      seoDescription={String(values.seo_description ?? "")}
                      excerpt={String(values.excerpt ?? "")}
                    />
                  )}
                </div>
              ) : (
                <>
                  <Label htmlFor={`f-${field.name}`}>{field.label}</Label>
                  <Input
                    id={`f-${field.name}`}
                    type={field.type}
                    min={field.min}
                    step={field.step}
                    value={String(values[field.name] ?? "")}
                    onChange={(e) =>
                      setValues((prev) => ({
                        ...prev,
                        [field.name]:
                          field.type === "number"
                            ? Number(e.target.value)
                            : e.target.value,
                      }))
                    }
                  />
                  {field.hint && (
                    <p className="text-xs text-muted-foreground">{field.hint}</p>
                  )}
                </>
              )}
            </div>
          ))}
          <DialogFooter className="items-center sm:justify-between">
            {enableAutosave ? <AutosaveIndicator status={autosaveStatus} /> : <span />}
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AutosaveIndicator({ status }: { status: ReturnType<typeof useAutosave> }) {
  switch (status) {
    case "pending":
    case "saving":
      return (
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          Saving…
        </span>
      );
    case "saved":
      return (
        <span className="flex items-center gap-1.5 text-xs text-ws-green-deep dark:text-ws-green">
          <Check className="size-3.5" aria-hidden />
          Saved
        </span>
      );
    case "error":
      return (
        <span className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="size-3.5" aria-hidden />
          Couldn&apos;t save
        </span>
      );
    case "offline":
      return (
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CloudOff className="size-3.5" aria-hidden />
          Offline
        </span>
      );
    default:
      return <span />;
  }
}
