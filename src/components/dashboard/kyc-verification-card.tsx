"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/shared/glass-card";
import { toast } from "sonner";
import { ShieldCheck, Upload, CheckCircle2, Clock, Lock } from "lucide-react";
import { submitKYCDocument } from "@/lib/actions/kyc-actions";

export function KYCVerificationCard({ initialStatus = "unverified" }: { initialStatus?: string }) {
  const [status, setStatus] = useState<string>(initialStatus);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function compressImage(file: File, callback: (compressedUrl: string) => void) {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        const maxDimension = 1200;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.75);
          callback(compressedDataUrl);
        } else {
          callback(event.target?.result as string);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setIdFile(file);

      // Automatically compress image client-side to prevent any 1MB body limit errors!
      compressImage(file, (compressedUrl) => {
        setFilePreviewUrl(compressedUrl);
      });
    }
  }

  async function handleSubmitKYC(e: React.FormEvent) {
    e.preventDefault();
    if (!idFile) {
      toast.error("Please upload a photo of your Government ID or Driver's License.");
      return;
    }

    setSubmitting(true);

    const formData = new FormData();
    formData.append("document", idFile);
    if (filePreviewUrl) {
      formData.append("document_data_url", filePreviewUrl);
    }

    const result = await submitKYCDocument(formData);

    setSubmitting(false);

    if (result.ok) {
      setStatus("pending");
      toast.success("KYC Verification submitted! Admin review in 15 minutes.");
    } else {
      toast.error(result.error || "Failed to submit KYC document.");
    }
  }

  return (
    <GlassCard className="p-6 border-amber-500/30 bg-background/80">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border/50 pb-4 mb-6 gap-2">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-amber-400" />
            Account KYC & Identity Verification
          </h2>
          <p className="text-xs text-muted-foreground">
            Verify your age (18+) and identity to unlock fast 15-minute cashouts and priority VIP rewards.
          </p>
        </div>

        <div>
          {(status === "verified" || status === "approved") && (
            <Badge className="bg-emerald-500/20 text-emerald-400 font-bold px-3 py-1 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> VERIFIED PLAYER
            </Badge>
          )}
          {status === "pending" && (
            <Badge className="bg-amber-500/20 text-amber-400 font-bold px-3 py-1 flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 animate-spin" /> UNDER REVIEW
            </Badge>
          )}
          {(status === "unverified" || status === "rejected") && (
            <Badge variant="outline" className="bg-rose-500/10 text-rose-400 font-bold px-3 py-1">
              {status === "rejected" ? "REJECTED - REUPLOAD ID" : "UNVERIFIED"}
            </Badge>
          )}
        </div>
      </div>

      {(status === "unverified" || status === "rejected") && (
        <form onSubmit={handleSubmitKYC} className="space-y-4">
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-start gap-3">
            <Lock className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground">
              <strong className="text-foreground font-bold block mb-0.5">Encrypted & Secure Storage</strong>
              Your document is encrypted with AES-256 and used strictly for age (18+) and anti-fraud verification.
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-foreground mb-1">
              Upload Photo of Government ID / Driver's License
            </label>
            <div className="rounded-xl border border-dashed border-border/80 bg-background/60 p-6 text-center hover:border-amber-500/50 transition-all">
              {filePreviewUrl ? (
                <div className="space-y-2">
                  <img
                    src={filePreviewUrl}
                    alt="ID Preview"
                    className="max-h-40 rounded-lg mx-auto border border-amber-500/40 object-contain"
                  />
                  <p className="text-xs font-bold text-amber-400">{idFile?.name}</p>
                </div>
              ) : (
                <>
                  <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                  <label htmlFor="kyc-file-input" className="cursor-pointer text-xs font-bold text-amber-400 hover:underline">
                    Click to select ID photo or document
                  </label>
                </>
              )}

              <input
                type="file"
                accept="image/*,.pdf"
                onChange={handleFileChange}
                className="hidden"
                id="kyc-file-input"
              />
              <p className="text-[11px] text-muted-foreground mt-1">Supports JPG, PNG, WEBP, PDF (Auto-Compressed)</p>
            </div>
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className="w-full bg-amber-500 text-black hover:bg-amber-400 font-bold py-5 rounded-xl text-sm gap-2"
          >
            <ShieldCheck className="h-4 w-4" />
            {submitting ? "Submitting Document Photo to Admin..." : "Submit KYC Verification"}
          </Button>
        </form>
      )}

      {status === "pending" && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 text-center space-y-2">
          <Clock className="mx-auto h-10 w-10 text-amber-400 animate-pulse" />
          <h3 className="text-sm font-bold text-foreground">KYC Verification Under Review</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Your ID photo ({idFile?.name || "Uploaded ID"}) has been received by admin. Review takes 5 to 15 minutes.
          </p>
        </div>
      )}

      {(status === "verified" || status === "approved") && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-center space-y-2">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
          <h3 className="text-sm font-bold text-emerald-400">KYC Verification Complete</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Your account is fully verified! You have unlocked priority 15-minute cashouts and maximum deposit match bonuses.
          </p>
        </div>
      )}
    </GlassCard>
  );
}
