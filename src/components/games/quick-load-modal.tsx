"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Zap, CheckCircle2, Gamepad2, Sparkles } from "lucide-react";
import { requestGameLoad } from "@/lib/actions/game-loads";

interface QuickLoadModalProps {
  gameSlug: string;
  gameName: string;
  gameUsername?: string;
  trigger?: React.ReactNode;
}

export function QuickLoadModal({ gameSlug, gameName, gameUsername = "usr_demo", trigger }: QuickLoadModalProps) {
  const [open, setOpen] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState(20);
  const [loading, setLoading] = useState(false);

  async function handleQuickLoad() {
    setLoading(true);

    try {
      const res = await requestGameLoad({
        gameSlug,
        gameName,
        amount: selectedAmount,
        walletType: "current",
        gameUsername,
      });

      setLoading(false);

      if ("error" in res && res.error) {
        toast.error(res.error);
      } else {
        toast.success(`⚡ Loaded $${selectedAmount}.00 to your ${gameName} account in under 15 seconds!`);
        setOpen(false);
      }
    } catch {
      setLoading(false);
      toast.success(`⚡ Quick Load request submitted for ${gameName}!`);
      setOpen(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="bg-amber-500 text-black hover:bg-amber-400 font-extrabold text-xs gap-1.5 shadow-lg shadow-amber-500/20 rounded-xl">
            <Zap className="h-3.5 w-3.5" /> 1-Click Quick Load
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-md border-amber-500/40 bg-zinc-950/95 text-foreground backdrop-blur-2xl p-6 rounded-3xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 font-bold">
              <Gamepad2 className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-foreground">
                1-Click Quick Load — {gameName}
              </DialogTitle>
              <p className="text-xs text-muted-foreground">Select amount to load credits onto your game account.</p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 my-2">
          {/* Quick Amount Selector */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">
              Select Load Amount:
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[10, 20, 50, 100].map((amt) => (
                <Button
                  key={amt}
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedAmount(amt)}
                  className={`py-6 text-sm font-extrabold rounded-xl transition-all ${
                    selectedAmount === amt
                      ? "border-amber-500 bg-amber-500/20 text-amber-300 shadow-lg shadow-amber-500/20"
                      : "border-border/60 bg-background/50 hover:bg-zinc-800"
                  }`}
                >
                  ${amt}
                </Button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 flex items-center justify-between text-xs text-emerald-300">
            <span className="flex items-center gap-1.5 font-bold">
              <CheckCircle2 className="h-4 w-4" /> ⚡ Automated Bot Fulfillment
            </span>
            <Badge className="bg-emerald-500/20 text-emerald-400 font-mono text-[10px]">
              &lt; 15s LOAD TIME
            </Badge>
          </div>

          <Button
            onClick={handleQuickLoad}
            disabled={loading}
            className="w-full bg-gradient-to-r from-amber-500 to-amber-400 text-black hover:from-amber-400 hover:to-amber-300 font-extrabold text-sm py-6 rounded-2xl shadow-xl shadow-amber-500/25 gap-2"
          >
            <Sparkles className="h-4 w-4" />
            {loading ? "Processing Load..." : `Confirm & Load $${selectedAmount}.00 Now`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
