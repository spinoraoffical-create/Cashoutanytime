"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { requestGameAccountCreate } from "@/lib/actions/game-loads";
import {
  generateGamePassword,
  maxUsernameLenForGame,
  validateCustomGameAccountCredentials,
} from "@/lib/game-automation/account-username";
import { friendlyPlayerError } from "@/lib/player-safe-error";
import type { Game } from "@/lib/games";

type Step = "choose" | "username";

export function CreateGameAccountModal({
  game,
  open,
  onOpenChange,
  onCreated,
}: {
  game: Game;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}) {
  const [step, setStep] = useState<Step>("choose");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);

  function close() {
    if (busy) return;
    setStep("choose");
    setUsername("");
    onOpenChange(false);
  }

  async function create(custom?: { username: string; password: string }) {
    setBusy(true);
    const result = await requestGameAccountCreate({
      gameSlug: game.slug,
      gameName: game.name,
      username: custom?.username,
      password: custom?.password,
    });
    setBusy(false);
    if (result.error) {
      toast.error(
        friendlyPlayerError(
          result.error,
          "Account creation failed. Please try again or contact support."
        )
      );
      return;
    }
    toast.success(`Creating your ${game.name} sign-in…`);
    setStep("choose");
    setUsername("");
    onOpenChange(false);
    onCreated?.();
  }

  async function createOwn() {
    const password = generateGamePassword();
    const validated = validateCustomGameAccountCredentials(username, password, game.slug);
    if (!validated.ok) {
      toast.error(validated.error);
      return;
    }
    await create({ username: validated.username, password: validated.password });
  }

  const maxLen = maxUsernameLenForGame(game.slug);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
        else onOpenChange(true);
      }}
    >
      <DialogContent className="border-white/10 bg-[#141018] text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create game account</DialogTitle>
          <DialogDescription>
            {step === "choose"
              ? `Pick a username for ${game.name}, or let us create one.`
              : "Letters and numbers, 7–13 characters. We’ll set the password and show it here when the account is ready."}
          </DialogDescription>
        </DialogHeader>

        {step === "choose" ? (
          <div className="grid gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => setStep("username")}
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-left text-sm font-semibold hover:bg-white/10 disabled:opacity-50"
            >
              Choose my own username
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void create()}
              className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Create one for me
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={close}
              className="rounded-xl px-4 py-2 text-sm text-zinc-400 hover:text-white"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="grid gap-3">
            <input
              type="text"
              value={username}
              autoFocus
              autoComplete="off"
              placeholder="Username"
              minLength={7}
              maxLength={Math.min(maxLen, 13)}
              onChange={(e) =>
                setUsername(e.target.value.replace(/[^a-zA-Z0-9]/g, "").slice(0, Math.min(maxLen, 13)))
              }
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-sm outline-none"
            />
            <button
              type="button"
              disabled={busy || username.length < 7}
              onClick={() => void createOwn()}
              className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Create game account
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setStep("choose")}
              className="rounded-xl px-4 py-2 text-sm text-zinc-400 hover:text-white"
            >
              Cancel
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
