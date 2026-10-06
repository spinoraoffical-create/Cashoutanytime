"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, IdCard, Loader2, Mail, Phone } from "lucide-react";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { resendProfileVerification, savePlayerProfile } from "@/lib/actions/profile";
import { createClient } from "@/lib/supabase/client";
import { PROFILE_UPDATED_EVENT, type ProfileUpdatedDetail } from "@/lib/profile/events";

const MAX_PHOTO_BYTES = 12 * 1024 * 1024;

async function preparePhoto(file: File): Promise<File> {
  const name = file.name.toLowerCase();
  const heic = /hei[cf]$/.test(name) || file.type === "image/heic" || file.type === "image/heif";
  const image =
    file.type.startsWith("image/") ||
    heic ||
    /\.(jpe?g|png|webp|avif)$/.test(name);
  if (!image) throw new Error("Use a JPG or PNG photo.");
  if (file.size > MAX_PHOTO_BYTES) throw new Error("That photo is too large. Pick one under 12 MB.");

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not read that photo. Try a JPG."));
      el.src = url;
    });
    const maxSide = 1024;
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
    const width = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
    const height = Math.max(1, Math.round((img.naturalHeight || 1) * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not read that photo. Try a JPG.");
    ctx.drawImage(img, 0, 0, width, height);

    let quality = 0.86;
    let blob: Blob | null = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size <= 1_500_000) break;
      quality -= 0.18;
    }
    if (!blob) throw new Error("Could not read that photo. Try a JPG.");
    return new File([blob], "avatar.jpg", { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function smallPhotoDataUrl(file: File): Promise<string | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("unreadable"));
      el.src = url;
    });
    const side = 320;
    const scale = Math.min(1, side / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
    const width = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
    const height = Math.max(1, Math.round((img.naturalHeight || 1) * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, width, height);
    let quality = 0.72;
    let dataUrl = "";
    for (let attempt = 0; attempt < 5; attempt++) {
      dataUrl = canvas.toDataURL("image/jpeg", quality);
      if (dataUrl.startsWith("data:image/jpeg;base64,") && dataUrl.length <= 80_000) return dataUrl;
      quality -= 0.12;
    }
    return null;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function uploadPhotoInBrowser(file: File): Promise<string | null> {
  const supabase = createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const path = `${user.id}/avatar.jpg`;
  const { error } = await supabase.storage.from("avatars").upload(path, file, {
    upsert: true,
    contentType: "image/jpeg",
    cacheControl: "3600",
  });
  if (error) {
    console.error("[profile] photo upload:", error.message);
    return null;
  }
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  if (!data.publicUrl) return null;
  return `${data.publicUrl}?v=${Date.now()}`;
}

export type ProfileEditorProps = {
  displayName: string;
  email: string;
  emailVerified: boolean;
  phone: string;
  avatarUrl: string | null;
  kycStatus: string;
};

function initials(name: string) {
  const letters = name.replace(/[^a-z0-9]/gi, "");
  return (letters.slice(0, 2) || "P").toUpperCase();
}

function prettyPhone(value: string) {
  if (!value) return "";
  const raw = value.trim().startsWith("+") ? value.trim() : `+${value.replace(/\D/g, "")}`;
  const parsed = parsePhoneNumberFromString(raw);
  return parsed ? parsed.formatInternational() : value;
}

async function saveNameInBrowser(name: string, avatarUrl?: string | null) {
  const supabase = createClient();
  if (!supabase) return false;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const fields: { full_name: string; avatar_url?: string } = { full_name: name };
  if (avatarUrl) fields.avatar_url = avatarUrl;
  const { data, error } = await supabase
    .from("profiles")
    .update(fields)
    .eq("id", user.id)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    console.error("[profile] browser save:", error?.message ?? "no row");
    return false;
  }
  return true;
}

function kycLabel(status: string) {
  if (status === "verified" || status === "approved") return "VERIFIED";
  if (status === "pending") return "PENDING";
  if (status === "rejected") return "REJECTED";
  return "NOT STARTED";
}

export function EditProfileDialog({
  open,
  onOpenChange,
  profile,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: ProfileEditorProps;
  onSaved: (next: ProfileEditorProps) => void;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [phone, setPhone] = useState(prettyPhone(profile.phone));
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDisplayName(profile.displayName);
    setPhone(prettyPhone(profile.phone));
    setAvatarUrl(profile.avatarUrl);
    setPhoto(null);
    setPreview(null);
  }, [open, profile]);

  useEffect(() => {
    if (!photo) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    try {
      const ready = await preparePhoto(file);
      setPhoto(ready);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read that photo. Try a JPG.");
    }
  }

  async function resend() {
    setResending(true);
    const result = await resendProfileVerification(window.location.origin);
    setResending(false);
    if (!result.ok) {
      toast.error(result.error ?? "Could not send the verification email.");
      return;
    }
    toast.success("Verification email sent. Open it to confirm this address.");
  }

  async function save() {
    setSaving(true);
    const body = new FormData();
    body.set("displayName", displayName);
    body.set("phone", phone);
    if (photo) {
      const uploaded = await uploadPhotoInBrowser(photo);
      if (uploaded) body.set("avatarUrl", uploaded);
      else {
        body.set("photo", photo);
        const inline = await smallPhotoDataUrl(photo);
        if (inline) body.set("avatarData", inline);
      }
    }
    const result = await savePlayerProfile(body);
    if (!result.ok) {
      setSaving(false);
      toast.error(result.error ?? "Could not save your profile.");
      return;
    }
    const savedAvatar = result.avatarUrl || avatarUrl;
    await saveNameInBrowser(result.displayName ?? displayName, savedAvatar);
    setSaving(false);

    const next: ProfileEditorProps = {
      ...profile,
      displayName: result.displayName ?? displayName.trim(),
      phone: result.phone ?? phone,
      avatarUrl: result.avatarUrl || avatarUrl,
    };
    onSaved(next);
    const detail: ProfileUpdatedDetail = {
      name: next.displayName,
      avatarUrl: next.avatarUrl,
    };
    window.dispatchEvent(new CustomEvent(PROFILE_UPDATED_EVENT, { detail }));
    router.refresh();
    toast.success("Profile saved.");
    onOpenChange(false);
  }

  const shownPhoto = preview || avatarUrl;
  const kyc = kycLabel(profile.kycStatus);
  const hasPhone = Boolean(phone.trim() || profile.phone);

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="max-w-[420px] border-white/10 bg-[#16141f] p-5 text-white sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-extrabold text-white">Edit profile</DialogTitle>
          <DialogDescription className="text-sm text-white/60">
            Update your photo, display name and phone.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary text-lg font-black text-white"
            aria-label="Add photo"
          >
            {shownPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shownPhoto} alt="" className="h-full w-full object-cover" />
            ) : (
              initials(displayName || profile.displayName)
            )}
            <span className="absolute bottom-0 left-0 flex h-6 w-6 items-center justify-center rounded-full bg-black/70">
              <Camera className="h-3.5 w-3.5" />
            </span>
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">Profile photo</p>
            <p className="text-xs text-white/50">JPG or PNG. Large photos are resized for you.</p>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold"
            >
              <Camera className="h-3.5 w-3.5" /> Add photo
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/jpg,.jpg,.jpeg,.png"
            className="hidden"
            onChange={(event) => {
              pickPhoto(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </div>

        <label className="block space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white/45">Display name</span>
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            maxLength={40}
            autoComplete="nickname"
            className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm outline-none focus:border-primary"
          />
        </label>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/45">
              <Mail className="h-3.5 w-3.5" /> Email
            </span>
            <span
              className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                profile.emailVerified ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-400 text-black"
              }`}
            >
              {profile.emailVerified ? "VERIFIED" : "NOT VERIFIED"}
            </span>
          </div>
          <input
            value={profile.email}
            readOnly
            className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white/70 outline-none"
          />
          {!profile.emailVerified ? (
            <button
              type="button"
              onClick={() => void resend()}
              disabled={resending}
              className="text-sm font-bold text-primary disabled:opacity-60"
            >
              {resending ? "Sending…" : "Resend verification email"}
            </button>
          ) : null}
        </div>

        <label className="block space-y-1.5">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/45">
            <Phone className="h-3.5 w-3.5" /> Phone
          </span>
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            inputMode="tel"
            autoComplete="tel"
            placeholder="+1 555 123 4567"
            className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm outline-none focus:border-primary"
          />
        </label>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-white/80">
              <IdCard className="h-4 w-4" /> ID verification (KYC)
            </p>
            <span className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white/70">{kyc}</span>
          </div>
          <p className="mt-2 text-sm text-white/55">
            Required for cashouts above the verified-account threshold.
            {hasPhone ? "" : " Verify your phone first."}
          </p>
          <button
            type="button"
            className="mt-3 h-11 w-full rounded-xl bg-primary/80 text-sm font-bold text-white"
            onClick={() => {
              if (!hasPhone) {
                toast.error("Save a phone number before verifying your ID.");
                return;
              }
              onOpenChange(false);
              router.push("/dashboard/kyc");
            }}
          >
            Verify ID now
          </button>
        </div>

        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="h-11 w-full rounded-xl bg-primary text-sm font-extrabold text-white disabled:opacity-60"
        >
          {saving ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Saving…
            </span>
          ) : (
            "Save"
          )}
        </button>
      </DialogContent>
    </Dialog>
  );
}
