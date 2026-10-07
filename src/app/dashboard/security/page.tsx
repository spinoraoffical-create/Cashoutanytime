"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Fingerprint, KeyRound, LogOut, Monitor, Shield } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

type PasskeyRow = { id: string; name: string };
type SignInRow = { label: string; when: string };

function deviceLabel() {
  const ua = navigator.userAgent;
  if (/iPhone|iPad/.test(ua)) return "iPhone";
  if (/Android/.test(ua)) return "Android";
  if (/Mac/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows";
  if (/Linux/.test(ua)) return "Linux";
  return "This browser";
}

function ago(iso: string) {
  const delta = Date.now() - new Date(iso).getTime();
  const mins = Math.max(1, Math.round(delta / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function SecurityPage() {
  const router = useRouter();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [twoFa, setTwoFa] = useState<"off" | "on" | "setup">("off");
  const [factorId, setFactorId] = useState("");
  const [secret, setSecret] = useState("");
  const [qr, setQr] = useState("");
  const [code, setCode] = useState("");
  const [passkeys, setPasskeys] = useState<PasskeyRow[]>([]);
  const [signIns, setSignIns] = useState<SignInRow[]>([]);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    void supabase.auth.mfa.listFactors().then(async ({ data }) => {
      const pending = data?.totp?.filter((factor) => factor.status !== "verified") ?? [];
      await Promise.all(pending.map((factor) => supabase.auth.mfa.unenroll({ factorId: factor.id })));
      const verified = data?.totp?.find((factor) => factor.status === "verified");
      if (verified) {
        setTwoFa("on");
        setFactorId(verified.id);
      }
    });
    void supabase.auth.passkey.list().then(({ data }) => {
      const rows = Array.isArray(data) ? data : [];
      setPasskeys(
        rows.map((row) => {
          const item = row as { id?: string; friendly_name?: string; name?: string };
          return { id: String(item.id || ""), name: item.friendly_name || item.name || "Passkey" };
        }).filter((row) => row.id)
      );
    }).catch(() => setPasskeys([]));
    void supabase.auth.getUser().then(({ data }) => {
      const when = data.user?.last_sign_in_at || new Date().toISOString();
      const current = { label: deviceLabel(), when };
      const key = "hub-signins";
      const prior = JSON.parse(localStorage.getItem(key) || "[]") as SignInRow[];
      const next = [current, ...prior.filter((row) => row.when !== current.when)].slice(0, 5);
      localStorage.setItem(key, JSON.stringify(next));
      setSignIns(next);
    });
  }, []);

  async function savePassword(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      toast.error("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Those passwords don’t match.");
      return;
    }
    const supabase = createClient();
    if (!supabase) return;
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) {
      toast.error(error.message || "Could not update that password.");
      return;
    }
    setPassword("");
    setConfirm("");
    setPasswordOpen(false);
    toast.success("Password updated.");
  }

  async function enableTwoFa() {
    const supabase = createClient();
    if (!supabase) return;
    setBusy("2fa");
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Authenticator",
    });
    setBusy("");
    if (error || !data) {
      toast.error(error?.message || "Two-factor setup did not start.");
      return;
    }
    setFactorId(data.id);
    setSecret(data.totp.secret);
    setQr(data.totp.qr_code);
    setTwoFa("setup");
  }

  async function confirmTwoFa() {
    const supabase = createClient();
    if (!supabase || !factorId) return;
    setBusy("2fa");
    const challenge = await supabase.auth.mfa.challenge({ factorId });
    if (challenge.error || !challenge.data) {
      setBusy("");
      toast.error(challenge.error?.message || "Could not start the code check.");
      return;
    }
    const verified = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.data.id,
      code: code.replace(/\s/g, ""),
    });
    setBusy("");
    if (verified.error) {
      toast.error(verified.error.message || "That code did not match.");
      return;
    }
    setTwoFa("on");
    setCode("");
    toast.success("Two-factor authentication is on.");
  }

  async function disableTwoFa() {
    const supabase = createClient();
    if (!supabase || !factorId) return;
    setBusy("2fa");
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    setBusy("");
    if (error) {
      toast.error(error.message || "Could not turn off two-factor.");
      return;
    }
    setTwoFa("off");
    setFactorId("");
    toast.success("Two-factor authentication is off.");
  }

  async function addPasskey() {
    const supabase = createClient();
    if (!supabase) return;
    setBusy("passkey");
    const { error } = await supabase.auth.registerPasskey();
    setBusy("");
    if (error) {
      toast.error(error.message || "Passkey setup did not finish.");
      return;
    }
    const listed = await supabase.auth.passkey.list();
    const rows = Array.isArray(listed.data) ? listed.data : [];
    setPasskeys(
      rows.map((row) => {
        const item = row as { id?: string; friendly_name?: string; name?: string };
        return { id: String(item.id || ""), name: item.friendly_name || item.name || "Passkey" };
      }).filter((row) => row.id)
    );
    toast.success("Passkey saved on this device.");
  }

  async function signOutEverywhere() {
    const supabase = createClient();
    if (!supabase) return;
    setBusy("out");
    const { error } = await supabase.auth.signOut({ scope: "global" });
    setBusy("");
    if (error) {
      toast.error(error.message || "Could not sign out other sessions.");
      return;
    }
    router.push("/login");
  }

  return (
    <div className="space-y-4 pb-8">
      <section className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#1a1030] via-[#24152e] to-[#0c1c3a] p-5">
        <p className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#b9b3c6]">
          <Shield className="h-3 w-3" /> Protected access
        </p>
        <h1 className="mt-3 text-4xl font-black">Security</h1>
        <p className="mt-2 max-w-md text-sm text-[#b9b3c6]">
          Choose how you sign in, recover access, and review devices without changing your account money.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
          <span className="rounded-full bg-black/30 px-3 py-1">Password active</span>
          <span className="rounded-full bg-black/30 px-3 py-1">{twoFa === "on" ? "2FA on" : "2FA off"}</span>
          <span className="rounded-full bg-black/30 px-3 py-1">{passkeys.length} passkeys</span>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#1a1024] p-4">
        <div className="flex items-start gap-3">
          <KeyRound className="mt-0.5 h-4 w-4 text-[#b9b3c6]" />
          <div className="min-w-0 flex-1">
            <p className="font-bold">Password</p>
            <p className="text-sm text-[#b9b3c6]">Change the password you sign in with.</p>
            <button
              type="button"
              onClick={() => setPasswordOpen((open) => !open)}
              className="mt-3 rounded-lg bg-black px-3 py-1.5 text-sm font-bold"
            >
              Change password
            </button>
            {passwordOpen ? (
              <form onSubmit={savePassword} className="mt-3 space-y-2">
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="New password"
                  autoComplete="new-password"
                  className="h-11 w-full rounded-xl border border-white/10 bg-[#160812] px-3 text-sm outline-none"
                />
                <input
                  type="password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  placeholder="Confirm password"
                  autoComplete="new-password"
                  className="h-11 w-full rounded-xl border border-white/10 bg-[#160812] px-3 text-sm outline-none"
                />
                <button type="submit" disabled={saving} className="rounded-lg bg-[#ff6b89] px-3 py-2 text-sm font-bold text-[#3a1020]">
                  {saving ? "Saving…" : "Save password"}
                </button>
              </form>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#1a1024] p-4">
        <p className="font-bold">Two-factor authentication</p>
        <p className="text-sm text-[#b9b3c6]">Add an extra code from your authenticator app at sign-in.</p>
        {twoFa === "on" ? (
          <button type="button" onClick={() => void disableTwoFa()} disabled={busy === "2fa"} className="mt-3 rounded-lg bg-[#ff6b89] px-3 py-2 text-sm font-bold text-[#3a1020]">
            {busy === "2fa" ? "Working…" : "Turn off 2FA"}
          </button>
        ) : (
          <button type="button" onClick={() => void enableTwoFa()} disabled={busy === "2fa"} className="mt-3 rounded-lg bg-[#ff6b89] px-3 py-2 text-sm font-bold text-[#3a1020]">
            {busy === "2fa" ? "Working…" : "Enable 2FA"}
          </button>
        )}
        {twoFa === "setup" ? (
          <div className="mt-3 space-y-2">
            {qr.startsWith("data:") || qr.startsWith("http") ? (
              <img src={qr} alt="Authenticator QR code" className="h-36 w-36 rounded-lg bg-white p-2" />
            ) : null}
            <p className="break-all font-mono text-xs text-[#b9b3c6]">{secret}</p>
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              inputMode="numeric"
              placeholder="6-digit code"
              className="h-11 w-full rounded-xl border border-white/10 bg-[#160812] px-3 text-sm outline-none"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => void confirmTwoFa()} className="rounded-lg bg-[#ff6b89] px-3 py-2 text-sm font-bold text-[#3a1020]">
                Confirm code
              </button>
              <button
                type="button"
                onClick={() => {
                  const supabase = createClient();
                  if (supabase && factorId) void supabase.auth.mfa.unenroll({ factorId });
                  setTwoFa("off");
                  setFactorId("");
                  setSecret("");
                  setQr("");
                  setCode("");
                }}
                className="rounded-lg border border-white/15 px-3 py-2 text-sm font-bold"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#1a1024] p-4">
        <div className="flex items-start gap-3">
          <Fingerprint className="mt-0.5 h-4 w-4 text-[#b9b3c6]" />
          <div>
            <p className="font-bold">Passkeys</p>
            <p className="text-sm text-[#b9b3c6]">Sign in with Face ID, Touch ID, or Windows Hello — no password needed.</p>
            <button type="button" onClick={() => void addPasskey()} disabled={busy === "passkey"} className="mt-3 rounded-lg bg-[#ff6b89] px-3 py-2 text-sm font-bold text-[#3a1020]">
              {busy === "passkey" ? "Waiting for this device…" : "Add passkey"}
            </button>
          </div>
        </div>
        <p className="mt-4 border-t border-white/10 pt-3 text-sm text-[#b9b3c6]">
          {passkeys.length ? passkeys.map((row) => row.name).join(", ") : "No passkeys are saved to this account yet."}
        </p>
      </section>

      <section>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-bold">Devices and sign-in history</p>
            <p className="text-sm text-[#b9b3c6]">Recent sign-ins on this browser.</p>
          </div>
          <button type="button" onClick={() => void signOutEverywhere()} disabled={busy === "out"} className="rounded-full border border-white/15 px-3 py-2 text-sm font-bold">
            <span className="inline-flex items-center gap-1"><LogOut className="h-3.5 w-3.5" /> Sign out everywhere</span>
            <span className="mt-0.5 block text-[11px] font-medium text-[#b9b3c6]">Signs out this device too</span>
          </button>
        </div>
        <ul className="mt-3 divide-y divide-white/10">
          {signIns.map((row) => (
            <li key={row.when} className="flex items-center gap-3 py-3 text-sm">
              <Monitor className="h-4 w-4 text-[#b9b3c6]" />
              <span className="font-bold">{row.label}</span>
              <span className="text-[#b9b3c6]">This browser · {ago(row.when)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
