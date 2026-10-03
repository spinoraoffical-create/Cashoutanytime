"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { broadcastAdminNotice } from "@/lib/actions/admin";
import { toast } from "sonner";
import { Megaphone } from "lucide-react";

const MAINTENANCE_TEMPLATE = {
  title: "Site under maintenance",
  message:
    "Spinora is currently under maintenance. No requests (loads, redeems, new accounts, or deposits) will be approved until further notice. Thank you for your patience — we will update you when service resumes.",
} as const;

export function AdminBroadcastNotice() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sendChat, setSendChat] = useState(true);
  const [loading, setLoading] = useState(false);

  function applyMaintenanceTemplate() {
    setTitle(MAINTENANCE_TEMPLATE.title);
    setMessage(MAINTENANCE_TEMPLATE.message);
    toast.message("Maintenance template loaded — edit the text, then click Send to all users.");
  }

  async function handleSend() {
    const trimmedTitle = title.trim();
    const trimmedMessage = message.trim();

    if (!trimmedTitle || !trimmedMessage) {
      toast.error("Enter a title and message first");
      return;
    }

    const ok = window.confirm(
      `Send this notice to EVERY user?\n\nTitle: ${trimmedTitle}\n\nThey will get a notification${sendChat ? " and a support chat message" : ""}.`
    );
    if (!ok) return;

    setLoading(true);
    const result = await broadcastAdminNotice({
      title: trimmedTitle,
      message: trimmedMessage,
      type: "warning",
      sendChat,
    });
    if (result.error) toast.error(result.error);
    else {
      toast.success(`Notice sent to ${result.count ?? 0} users`);
      setTitle("");
      setMessage("");
    }
    setLoading(false);
  }

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 sm:p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
          <Megaphone className="h-4 w-4 text-amber-400" />
        </div>
        <div className="min-w-0">
          <h2 className="font-semibold text-white">Broadcast notice to all users</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Type your own title and message below, then send. Every non-admin user gets an in-app
            notification. Optionally also posts in their Support chat.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Title</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Service update, New promo, Maintenance"
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Message</label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write the notice users will see…"
            rows={4}
            className="mt-1 resize-y min-h-[96px]"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={sendChat}
            onChange={(e) => setSendChat(e.target.checked)}
            className="rounded border-border"
          />
          Also send as Support chat message
        </label>
      </div>

      <div className="flex flex-col sm:flex-row flex-wrap gap-2">
        <Button
          variant="default"
          className="bg-amber-600 hover:bg-amber-700"
          onClick={handleSend}
          disabled={loading}
        >
          {loading ? "Sending…" : "Send to all users"}
        </Button>
        <Button type="button" variant="outline" onClick={applyMaintenanceTemplate} disabled={loading}>
          Load maintenance template
        </Button>
      </div>
    </div>
  );
}
