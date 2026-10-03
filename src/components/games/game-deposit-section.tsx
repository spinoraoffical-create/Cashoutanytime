"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Banknote,
  Check,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  Upload,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { submitDepositRequest } from "@/lib/actions/deposits";
import { uploadDepositProofImage } from "@/lib/deposits/proof-upload";
import {
  DEPOSIT_PAYMENT_METHODS,
  type DepositPaymentMethodId,
} from "@/lib/payments/methods";
import type { Game } from "@/lib/games";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface GameDepositSectionProps {
  game: Game;
  /** Hide scroll anchor when rendered on /dashboard/deposit */
  hideSectionAnchor?: boolean;
}

export function GameDepositSection({ game, hideSectionAnchor }: GameDepositSectionProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedMethod, setSelectedMethod] = useState<DepositPaymentMethodId>("paypal");
  const [amount, setAmount] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [qrError, setQrError] = useState(false);

  const method = DEPOSIT_PAYMENT_METHODS.find((m) => m.id === selectedMethod)!;

  function handleCopyUsername() {
    void navigator.clipboard.writeText(method.username);
    toast.success(`${method.copyLabel} copied!`);
  }

  function handleDownloadQr() {
    if (qrError) {
      toast.error("QR image not uploaded yet — add it to /public/payments/");
      return;
    }
    const link = document.createElement("a");
    link.href = method.qrImage;
    link.download = `${method.id}-qr.png`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.click();
  }

  function handleProofSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image screenshot.");
      return;
    }
    setProofFile(file);
    setProofPreview(URL.createObjectURL(file));
  }

  async function handleSubmit() {
    if (!proofFile) {
      toast.error("Upload a screenshot of your payment.");
      return;
    }

    setSubmitting(true);

    const { data: { user } } = (await supabase?.auth.getUser()) ?? { data: { user: null } };
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(`/games/${game.slug}`)}`);
      setSubmitting(false);
      return;
    }

    if (!supabase) {
      toast.error("Upload unavailable.");
      setSubmitting(false);
      return;
    }

    const upload = await uploadDepositProofImage(supabase, user.id, proofFile);
    if ("error" in upload) {
      toast.error(upload.error);
      setSubmitting(false);
      return;
    }

    const parsedAmount = amount.trim() ? parseFloat(amount) : undefined;

    const result = await submitDepositRequest({
      gameSlug: game.slug,
      gameName: game.name,
      paymentMethod: selectedMethod,
      amount: parsedAmount,
      proofPath: upload.path,
    });

    setSubmitting(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Deposit proof sent! We'll credit your account after review.");
    setProofFile(null);
    setProofPreview(null);
    setAmount("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    router.push("/dashboard/deposits");
  }

  return (
    <section
      id={hideSectionAnchor ? undefined : "deposit"}
      className="rounded-2xl border border-white/10 bg-[#1a1a1a] p-4 sm:p-5 scroll-mt-24"
    >
      <div className="flex items-center gap-2 mb-4">
        <Banknote className="h-5 w-5 text-emerald-400" />
        <h2 className="font-bold text-white">Deposit</h2>
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        Choose a payment method, send your deposit, then upload a screenshot. Our team will credit your{" "}
        {game.name} account after verification.
      </p>

      <div className="flex flex-wrap gap-2 mb-5">
        {DEPOSIT_PAYMENT_METHODS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => {
              setSelectedMethod(m.id);
              setQrError(false);
            }}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs font-semibold border transition-colors",
              selectedMethod === m.id
                ? "bg-orange-500/20 border-orange-500/50 text-orange-300"
                : "bg-white/5 border-white/10 text-muted-foreground hover:text-white hover:border-white/20"
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div
        className={cn(
          "rounded-xl border p-4 sm:p-6 mb-4 flex flex-col items-center text-center",
          method.accent
        )}
      >
        <div className="flex flex-col items-center w-full max-w-sm mx-auto">
          <div className="relative w-full aspect-square max-w-[280px] sm:max-w-[320px] rounded-2xl overflow-hidden border border-white/10 bg-white shadow-lg">
            {!qrError ? (
              <Image
                src={method.qrImage}
                alt={`${method.label} QR code`}
                fill
                className="object-contain p-1 sm:p-1.5"
                sizes="(max-width: 640px) 280px, 320px"
                unoptimized
                onError={() => setQrError(true)}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center p-3 text-center">
                <p className="text-[10px] text-gray-500">
                  Add your {method.label} QR to
                  <br />
                  <code className="text-[9px]">public/payments/{method.id}-qr.png</code>
                </p>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleDownloadQr}
            className="mt-3 flex items-center gap-1.5 text-xs text-orange-400 hover:underline"
          >
            <Download className="h-3.5 w-3.5" />
            Download QR
          </button>
        </div>

        <div className="flex flex-col items-center w-full max-w-sm mx-auto mt-5 pt-5 border-t border-white/10">
          <p className="text-xs text-muted-foreground mb-1">{method.copyLabel}</p>
          <p className="font-mono text-base sm:text-lg text-white break-all mb-4">{method.username}</p>
          <div className="flex flex-col gap-2 w-full">
            <button
              type="button"
              onClick={handleCopyUsername}
              className="inline-flex items-center justify-center gap-2 rounded-lg py-2.5 px-4 text-sm font-semibold bg-[#2a2a2a] border border-white/10 hover:border-white/20 text-white transition-colors w-full"
            >
              <Copy className="h-4 w-4" />
              Copy {method.label} details
            </button>
            {method.payLink && (
              <a
                href={method.payLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-lg py-2.5 px-4 text-sm font-semibold bg-orange-500/15 border border-orange-500/40 hover:border-orange-500/60 text-orange-200 transition-colors w-full"
              >
                <ExternalLink className="h-4 w-4" />
                Pay using link
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label htmlFor="deposit-amount" className="text-xs text-muted-foreground block mb-1.5">
            Amount sent (optional)
          </label>
          <input
            id="deposit-amount"
            type="number"
            min="1"
            step="0.01"
            placeholder="e.g. 50"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-[#242424] px-4 py-3 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-orange-500/40"
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground block mb-1.5">
            Payment screenshot (required)
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleProofSelect}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 px-4 text-sm font-semibold bg-[#2a2a2a] border border-dashed border-white/15 hover:border-orange-500/40 text-white transition-colors"
          >
            <Upload className="h-4 w-4" />
            {proofFile ? proofFile.name : "Upload payment screenshot"}
          </button>
          {proofPreview && (
            <div className="mt-3 relative h-32 w-full max-w-xs rounded-lg overflow-hidden border border-white/10">
              <Image src={proofPreview} alt="Payment proof preview" fill className="object-cover" unoptimized />
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || !proofFile}
          className="w-full flex items-center justify-center gap-2 rounded-xl py-4 px-6 text-base font-bold text-black bg-gradient-to-r from-emerald-400 to-teal-500 hover:opacity-95 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Check className="h-5 w-5" />
          )}
          Submit deposit proof
        </button>
      </div>
    </section>
  );
}
