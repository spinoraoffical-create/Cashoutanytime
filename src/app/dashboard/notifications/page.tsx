"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Bell, Download, Gift, Megaphone, Shield } from "lucide-react";
import { toast } from "sonner";
import { getAccountPrefs, saveAccountPrefs } from "@/lib/actions/account-prefs";

type PrefState = {
  emailNotices: boolean;
  promoNotices: boolean;
  smsMarketing: boolean;
  whatsappMarketing: boolean;
};

export default function NotificationSettingsPage() {
  const [prefs, setPrefs] = useState<PrefState>({
    emailNotices: true,
    promoNotices: true,
    smsMarketing: false,
    whatsappMarketing: false,
  });
  const [pushOn, setPushOn] = useState(false);
  const [quiet, setQuiet] = useState(false);
  const [snooze, setSnooze] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void getAccountPrefs().then((loaded) => {
      setPrefs({
        emailNotices: loaded.emailNotices,
        promoNotices: loaded.promoNotices,
        smsMarketing: loaded.smsMarketing,
        whatsappMarketing: loaded.whatsappMarketing,
      });
    });
    setPushOn(localStorage.getItem("hub-push") === "on" && Notification.permission === "granted");
    setQuiet(localStorage.getItem("hub-quiet-hours") === "1");
    const until = localStorage.getItem("hub-promo-snooze-until");
    if (until && new Date(until).getTime() > Date.now()) setSnooze(until);
  }, []);

  async function save(next: Partial<PrefState>) {
    const previous = prefs;
    const payload = { ...prefs, ...next };
    setPrefs(payload);
    setSaving(true);
    const result = await saveAccountPrefs(payload);
    setSaving(false);
    if (!result.ok) {
      setPrefs(previous);
      toast.error(result.error ?? "Could not save.");
    }
  }

  async function togglePush() {
    if (pushOn) {
      localStorage.setItem("hub-push", "off");
      setPushOn(false);
      toast.success("Lock-screen alerts are off on this device.");
      return;
    }
    if (!("Notification" in window)) {
      toast.error("This browser does not support lock-screen alerts.");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      toast.error("Allow notifications in the browser to turn this on.");
      return;
    }
    localStorage.setItem("hub-push", "on");
    setPushOn(true);
    toast.success("Lock-screen alerts are on.");
  }

  function snoozeFor(hours: number) {
    const until = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    localStorage.setItem("hub-promo-snooze-until", until);
    setSnooze(until);
    toast.success(`Promo alerts snoozed for ${hours === 1 ? "1 hour" : hours === 8 ? "8 hours" : "1 day"}.`);
  }

  async function testPush() {
    if (!("Notification" in window)) {
      toast.error("This browser does not support lock-screen alerts.");
      return;
    }
    const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    if (permission !== "granted") {
      toast.error("Allow notifications, then send the test again.");
      return;
    }
    new Notification("Sweepstakes Hub", { body: "Test push delivered to this device." });
    toast.success("Test push sent.");
  }

  return (
    <div className="space-y-4 pb-10">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#1a1030] via-[#24152e] to-[#102044] p-5">
        <p className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em]">
          <Bell className="h-3 w-3" /> Message lounge
        </p>
        <h1 className="mt-3 text-4xl font-black">Notifications</h1>
        <p className="mt-2 max-w-md text-sm text-[#b9b3c6]">
          Control device alerts, account updates, and optional offers from one clear place.
        </p>
        <div className="mt-4 flex gap-2 text-xs font-bold">
          <span className="rounded-full bg-black/30 px-3 py-1">{pushOn ? "Device push on" : "Device push off"}</span>
          <span className="rounded-full bg-black/30 px-3 py-1">Preferences ready</span>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#1a1024] p-4">
        <p className="flex items-center gap-2 font-bold"><Bell className="h-4 w-4" /> Push notifications</p>
        <p className="text-sm text-[#b9b3c6]">{pushOn ? "On — you'll get lock-screen alerts on this device." : "Off — lock-screen alerts stay off on this device."}</p>
        <button type="button" onClick={() => void togglePush()} className="mt-3 rounded-lg bg-black px-3 py-1.5 text-sm font-bold">
          {pushOn ? "Disable" : "Enable"}
        </button>
      </section>

      <p className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-[#b9b3c6]">
        These controls do different jobs. News + game launches below controls your offer opt-in. Browser push only controls lock-screen alerts. Your in-app inbox works either way.
      </p>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#1a1024]">
        <Toggle
          icon={<Download className="h-4 w-4" />}
          title="Redeem updates"
          body="Status changes on your withdrawal requests."
          checked={prefs.emailNotices}
          disabled={saving}
          onChange={(checked) => void save({ emailNotices: checked })}
        />
        <Toggle
          icon={<Gift className="h-4 w-4" />}
          title="Bonus + offers"
          body="Reload reminders and new bonus offers. SMS and WhatsApp stay separate and opt-in."
          checked={prefs.promoNotices}
          disabled={saving}
          onChange={(checked) => void save({ promoNotices: checked, smsMarketing: checked ? prefs.smsMarketing : false })}
        />
        <div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-3">
          <span>
            <span className="flex items-center gap-2 font-bold"><Shield className="h-4 w-4" /> Security alerts</span>
            <span className="block text-sm text-[#b9b3c6]">New device sign-ins, 2FA changes, suspicious activity.</span>
          </span>
          <span className="text-xs font-black text-[#7ec8ff]">ALWAYS ON</span>
        </div>
        <Toggle
          icon={<Megaphone className="h-4 w-4" />}
          title="News + game launches"
          body="Newsletters and new game notes. Turn this off and those emails stop."
          checked={prefs.promoNotices}
          disabled={saving}
          onChange={(checked) => void save({ promoNotices: checked })}
        />
      </div>
      <p className="text-center text-xs text-[#b9b3c6]">Security alerts can&apos;t be fully silenced — we&apos;ll still surface high-risk events in-app.</p>

      <section className="rounded-2xl border border-white/10 bg-[#1a1024] p-4">
        <p className="font-bold">Snooze promo pushes</p>
        <p className="text-sm text-[#b9b3c6]">
          Pause bonus and promo pop-ups for a while. Payment and security alerts still come through.
          {snooze ? ` Snoozed until ${new Date(snooze).toLocaleTimeString()}.` : ""}
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[1, 8, 24].map((hours) => (
            <button key={hours} type="button" onClick={() => snoozeFor(hours)} className="h-11 rounded-xl border border-white/10 text-sm font-bold">
              {hours === 24 ? "1 day" : `${hours} hour${hours === 1 ? "" : "s"}`}
            </button>
          ))}
        </div>
      </section>

      <section className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#1a1024] p-4">
        <span>
          <span className="block font-bold">Quiet hours</span>
          <span className="text-sm text-[#b9b3c6]">Pause non-urgent pushes overnight. Security alerts still get through.</span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={quiet}
          onClick={() => {
            const next = !quiet;
            setQuiet(next);
            localStorage.setItem("hub-quiet-hours", next ? "1" : "0");
            toast.success(next ? "Quiet hours are on." : "Quiet hours are off.");
          }}
          className={`h-7 w-12 rounded-full p-1 ${quiet ? "bg-[#ff6b89]" : "bg-white/15"}`}
        >
          <span className={`block h-5 w-5 rounded-full bg-white transition ${quiet ? "translate-x-5" : ""}`} />
        </button>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#1a1024] p-4">
        <p className="font-bold">Test push delivery</p>
        <p className="text-sm text-[#b9b3c6]">Send a real push to this device to confirm everything&apos;s working.</p>
        <button type="button" onClick={() => void testPush()} className="mt-3 rounded-lg bg-[#ff6b89] px-3 py-2 text-sm font-bold text-[#3a1020]">
          Send test push
        </button>
      </section>
    </div>
  );
}

function Toggle({
  icon,
  title,
  body,
  checked,
  disabled,
  onChange,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-3 first:border-t-0">
      <span>
        <span className="flex items-center gap-2 font-bold">{icon} {title}</span>
        <span className="block text-sm text-[#b9b3c6]">{body}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`h-7 w-12 shrink-0 rounded-full p-1 disabled:opacity-50 ${checked ? "bg-[#ff6b89]" : "bg-white/15"}`}
      >
        <span className={`block h-5 w-5 rounded-full bg-white transition ${checked ? "translate-x-5" : ""}`} />
      </button>
    </div>
  );
}
