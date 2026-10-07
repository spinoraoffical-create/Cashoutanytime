"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { VipPageLayout } from "@/components/layout/vip-page-layout";

export default function GetAppPage() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    function onPrompt(event: Event) {
      event.preventDefault();
      setPrompt(event as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  async function install() {
    if (!prompt) {
      toast.message("Use your browser menu and choose Install app, or Add to Home Screen.");
      return;
    }
    await prompt.prompt();
    setPrompt(null);
  }

  return (
    <VipPageLayout>
    <div className="mx-auto w-full max-w-3xl space-y-4 px-1 pb-10">
      <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm font-semibold text-[#b9b3c6]">
        <ChevronLeft className="h-4 w-4" /> Back
      </Link>
      <h1 className="text-4xl font-black">Install or update app</h1>
      <p className="text-sm text-[#b9b3c6]">Add Sweepstakes Hub to this device so it opens like an app.</p>
      <button type="button" onClick={() => void install()} className="h-12 rounded-xl bg-[#ff6b89] px-4 text-sm font-bold text-[#3a1020]">
        Install app
      </button>
    </div>
    </VipPageLayout>
  );
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}
