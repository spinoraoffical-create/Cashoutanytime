"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { GlassCard } from "@/components/shared/glass-card";
import { Button } from "@/components/ui/button";
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
import { sendBroadcastAction } from "@/lib/actions/admin/broadcasts";
import type { BroadcastSegment } from "@/lib/database.types";

const SEGMENTS: { value: BroadcastSegment; label: string }[] = [
  { value: "all", label: "All members" },
  { value: "vip_silver_up", label: "Silver tier and up" },
  { value: "vip_gold_up", label: "Gold tier and up" },
  { value: "vip_platinum_up", label: "Platinum tier and up" },
  { value: "vip_diamond_up", label: "Diamond tier and up" },
  { value: "vip_elite", label: "Elite tier only" },
];

export function BroadcastComposer() {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [linkUrl, setLinkUrl] = React.useState("");
  const [segment, setSegment] = React.useState<BroadcastSegment>("all");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await sendBroadcastAction({
        title,
        body,
        link_url: linkUrl || undefined,
        segment,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Broadcast sent");
      setTitle("");
      setBody("");
      setLinkUrl("");
      setSegment("all");
      router.refresh();
    });
  }

  return (
    <GlassCard featured className="p-6">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="b-title">Title</Label>
          <Input
            id="b-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Weekend XP Surge is live"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="b-body">Message</Label>
          <Textarea
            id="b-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder="Tell members what's happening…"
            required
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="b-link">Link (optional)</Label>
            <Input
              id="b-link"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="/promotions"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="b-segment">Audience</Label>
            <Select
              value={segment}
              onValueChange={(v) => setSegment(v as BroadcastSegment)}
            >
              <SelectTrigger id="b-segment" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEGMENTS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Send className="size-4" aria-hidden />
          )}
          Send broadcast
        </Button>
      </form>
    </GlassCard>
  );
}
