"use client";

import { useState } from "react";
import { User } from "lucide-react";
import { EditProfileDialog, type ProfileEditorProps } from "@/components/player/edit-profile-dialog";

export function ProfileIdentityCard({ profile }: { profile: ProfileEditorProps }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(profile);

  return (
    <>
      <div className="hub-card flex items-center gap-4 rounded-[24px] p-5">
        <div className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-primary/20 text-lg font-bold">
          {current.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={current.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <User className="h-6 w-6" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-extrabold">{current.displayName}</p>
          <p className="truncate text-sm text-muted-foreground">{current.email}</p>
        </div>
        <button type="button" onClick={() => setOpen(true)} className="text-sm font-semibold text-primary">
          Edit
        </button>
      </div>
      <EditProfileDialog open={open} onOpenChange={setOpen} profile={current} onSaved={setCurrent} />
    </>
  );
}
