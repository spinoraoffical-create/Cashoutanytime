"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import { upsertPromotionAction } from "@/lib/actions/admin/promotions";
import type { Promotion } from "@/lib/database.types";

type Props = { promotion?: Promotion };

const STATUSES = ["draft", "scheduled", "active", "expired", "archived"] as const;

export function PromotionFormDialog({ promotion }: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const editing = Boolean(promotion);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await upsertPromotionAction({
        id: promotion?.id,
        slug: String(fd.get("slug") ?? ""),
        title: String(fd.get("title") ?? ""),
        summary: String(fd.get("summary") ?? ""),
        description: String(fd.get("description") ?? ""),
        badge_text: String(fd.get("badge_text") ?? "") || null,
        coins_bonus: Number(fd.get("coins_bonus") ?? 0),
        xp_bonus: Number(fd.get("xp_bonus") ?? 0),
        code: String(fd.get("code") ?? "") || null,
        status: fd.get("status") as (typeof STATUSES)[number],
        is_featured: fd.get("is_featured") === "on",
        priority: Number(fd.get("priority") ?? 100),
        starts_at: String(fd.get("starts_at") ?? "") || null,
        ends_at: String(fd.get("ends_at") ?? "") || null,
        max_claims: fd.get("max_claims") ? Number(fd.get("max_claims")) : null,
        max_claims_per_user: Number(fd.get("max_claims_per_user") ?? 1),
      });

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
        {editing ? (
          <Button variant="ghost" size="icon-sm" aria-label="Edit promotion">
            <Pencil className="size-4" aria-hidden />
          </Button>
        ) : (
          <Button>
            <Plus className="size-4" aria-hidden />
            New Promotion
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="glass-strong max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit promotion" : "Create promotion"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="p-title">Title</Label>
              <Input id="p-title" name="title" defaultValue={promotion?.title} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-slug">Slug</Label>
              <Input
                id="p-slug"
                name="slug"
                defaultValue={promotion?.slug}
                placeholder="welcome-boost"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-badge">Badge text</Label>
              <Input
                id="p-badge"
                name="badge_text"
                defaultValue={promotion?.badge_text ?? ""}
                placeholder="LIMITED"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="p-summary">Summary</Label>
            <Input id="p-summary" name="summary" defaultValue={promotion?.summary} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="p-desc">Description</Label>
            <Textarea
              id="p-desc"
              name="description"
              rows={3}
              defaultValue={promotion?.description}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="p-coins">Coins bonus</Label>
              <Input
                id="p-coins"
                name="coins_bonus"
                type="number"
                min={0}
                defaultValue={promotion?.coins_bonus ?? 0}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-xp">XP bonus</Label>
              <Input
                id="p-xp"
                name="xp_bonus"
                type="number"
                min={0}
                defaultValue={promotion?.xp_bonus ?? 0}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-code">Redeem code</Label>
              <Input
                id="p-code"
                name="code"
                defaultValue={promotion?.code ?? ""}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-status">Status</Label>
              <Select name="status" defaultValue={promotion?.status ?? "draft"}>
                <SelectTrigger id="p-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-priority">Priority</Label>
              <Input
                id="p-priority"
                name="priority"
                type="number"
                min={0}
                defaultValue={promotion?.priority ?? 100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-per-user">Max claims / user</Label>
              <Input
                id="p-per-user"
                name="max_claims_per_user"
                type="number"
                min={1}
                defaultValue={promotion?.max_claims_per_user ?? 1}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-starts">Starts at</Label>
              <Input
                id="p-starts"
                name="starts_at"
                type="datetime-local"
                defaultValue={toLocalInput(promotion?.starts_at)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-ends">Ends at</Label>
              <Input
                id="p-ends"
                name="ends_at"
                type="datetime-local"
                defaultValue={toLocalInput(promotion?.ends_at)}
              />
            </div>
          </div>

          <label className="flex items-center gap-3">
            <Checkbox
              name="is_featured"
              defaultChecked={promotion?.is_featured ?? false}
            />
            <span className="text-sm">Feature on promotions page</span>
          </label>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {editing ? "Save changes" : "Create promotion"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function toLocalInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
