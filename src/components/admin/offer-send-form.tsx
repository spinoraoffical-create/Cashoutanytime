"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendOfferAction } from "@/lib/actions/offers";

export function OfferSendForm({ emailCount, smsCount }: { emailCount: number; smsCount: number }) {
  const [subject, setSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [smsBody, setSmsBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    const result = await sendOfferAction({ subject, emailBody, smsBody });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const smsNote = result.smsReady ? `${result.smsCount} SMS` : "SMS is not configured, so no text was sent";
    toast.success(`Sent ${result.emailCount} email. ${smsNote}.`);
  }

  return (
    <form onSubmit={onSubmit} className="max-w-xl space-y-4">
      <p className="text-sm font-semibold">
        Email {emailCount}. SMS {smsCount}.
      </p>
      <div className="space-y-2">
        <Label htmlFor="offer-subject">Subject</Label>
        <Input id="offer-subject" value={subject} onChange={(event) => setSubject(event.target.value)} required maxLength={200} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="offer-email">Email</Label>
        <textarea
          id="offer-email"
          value={emailBody}
          onChange={(event) => setEmailBody(event.target.value)}
          required
          rows={6}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="offer-sms">SMS</Label>
        <Input id="offer-sms" value={smsBody} onChange={(event) => setSmsBody(event.target.value)} required maxLength={120} />
      </div>
      <Button type="submit" disabled={busy}>
        {busy ? "Sending..." : "Send"}
      </Button>
    </form>
  );
}
