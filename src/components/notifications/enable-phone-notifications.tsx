"use client";

import { useState } from "react";
import { toast } from "sonner";

import { pushEnableHelp, type PushPermissionState } from "@/lib/notifications/player-notice-rules";

function currentPermission(): PushPermissionState {
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

function keyBytes(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const raw = atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

export function EnablePhoneNotifications() {
  const [help, setHelp] = useState(pushEnableHelp("default"));
  const [busy, setBusy] = useState(false);

  async function enable() {
    const support = currentPermission();
    if (support === "unsupported") {
      setHelp(pushEnableHelp("unsupported"));
      return;
    }
    setBusy(true);
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setHelp(pushEnableHelp(permission === "denied" ? "denied" : "default"));
      setBusy(false);
      return;
    }
    const keyResponse = await fetch("/api/notifications/push/public-key");
    const keyBody = (await keyResponse.json()) as { publicKey?: string; error?: string };
    if (!keyResponse.ok || !keyBody.publicKey) {
      toast.error(keyBody.error ?? "Phone notifications are not configured yet.");
      setBusy(false);
      return;
    }
    const registration = await navigator.serviceWorker.register("/sw.js");
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes(keyBody.publicKey),
    });
    const json = subscription.toJSON();
    const saved = await fetch("/api/notifications/push/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
    });
    const result = (await saved.json()) as { error?: string };
    setBusy(false);
    if (!saved.ok) {
      toast.error(result.error ?? "This device could not be saved.");
      return;
    }
    setHelp(pushEnableHelp("granted"));
    toast.success("This device is registered. A phone alert is only confirmed after the provider accepts it.");
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-[#1a1024] p-4">
      <p className="font-bold">Enable Phone Notifications</p>
      <p className="text-sm text-[#b9b3c6]">{help}</p>
      <button type="button" onClick={() => void enable()} disabled={busy} className="mt-3 rounded-lg bg-[#ff6b89] px-3 py-2 text-sm font-bold text-[#3a1020] disabled:opacity-50">
        Enable Phone Notifications
      </button>
    </section>
  );
}
