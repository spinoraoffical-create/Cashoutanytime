"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/shared/glass-card";
import { toast } from "sonner";
import { ShieldCheck, CheckCircle2, XCircle, User, FileText, Eye, X, Image as ImageIcon } from "lucide-react";
import { KYCSubmissionRecord, updateKYCStatus } from "@/lib/actions/kyc-actions";

export function AdminKYCReviewCard({
  initialSubmissions = [],
}: {
  initialSubmissions?: KYCSubmissionRecord[];
}) {
  const [submissions, setSubmissions] = useState<KYCSubmissionRecord[]>(initialSubmissions);
  const [previewDoc, setPreviewDoc] = useState<KYCSubmissionRecord | null>(null);

  async function handleApprove(userId: string, name: string) {
    const res = await updateKYCStatus(userId, "approved");
    if (res.ok) {
      setSubmissions((prev) =>
        prev.map((s) => (s.user_id === userId ? { ...s, status: "approved" } : s))
      );
      toast.success(`Approved KYC for ${name}! Verified Player Badge granted.`);
      setPreviewDoc(null);
    } else {
      toast.error(res.error || "Failed to approve KYC.");
    }
  }

  async function handleReject(userId: string, name: string) {
    const res = await updateKYCStatus(userId, "rejected");
    if (res.ok) {
      setSubmissions((prev) =>
        prev.map((s) => (s.user_id === userId ? { ...s, status: "rejected" } : s))
      );
      toast.error(`Rejected KYC for ${name}.`);
      setPreviewDoc(null);
    } else {
      toast.error(res.error || "Failed to reject KYC.");
    }
  }

  return (
    <GlassCard className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border/50 pb-4 mb-6 gap-2">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            1-Click Non-Coder KYC Review Center
          </h2>
          <p className="text-sm text-muted-foreground">
            Inspect player government ID documents, verify age (18+), and grant Verified Player Badges.
          </p>
        </div>
        <Badge className="bg-emerald-500/20 text-emerald-400 font-mono shrink-0">
          KYC VERIFICATION ({submissions.length})
        </Badge>
      </div>

      {submissions.length === 0 ? (
        <div className="rounded-xl border border-border/60 bg-background/60 p-8 text-center space-y-2">
          <ShieldCheck className="mx-auto h-8 w-8 text-muted-foreground" />
          <h3 className="text-sm font-bold text-foreground">No Pending KYC Submissions</h3>
          <p className="text-xs text-muted-foreground">
            When a player uploads an ID on their dashboard, their submission will appear right here for 1-click review.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {submissions.map((s) => (
            <div
              key={s.id}
              className="rounded-xl border border-border/60 bg-background/60 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 font-bold">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-sm font-bold text-foreground">{s.user_name}</span>
                  <p className="text-xs text-muted-foreground font-mono">{s.user_email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <button
                      onClick={() => setPreviewDoc(s)}
                      className="text-[11px] text-amber-300 hover:text-amber-200 underline flex items-center gap-1 font-mono"
                    >
                      <Eye className="h-3.5 w-3.5" /> View Uploaded Photo ({s.document_name})
                    </button>
                    <span className="text-[10px] text-muted-foreground">
                      • {new Date(s.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPreviewDoc(s)}
                  className="border-amber-500/40 text-amber-300 hover:bg-amber-500/10 font-bold text-xs gap-1"
                >
                  <Eye className="h-3.5 w-3.5" /> View Photo
                </Button>

                {s.status === "pending" ? (
                  <>
                    <Button
                      size="sm"
                      onClick={() => handleApprove(s.user_id, s.user_name)}
                      className="bg-emerald-500 text-black hover:bg-emerald-400 font-bold text-xs gap-1"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReject(s.user_id, s.user_name)}
                      className="border-rose-500/40 text-rose-400 hover:bg-rose-500/10 font-bold text-xs gap-1"
                    >
                      <XCircle className="h-3.5 w-3.5" /> Reject
                    </Button>
                  </>
                ) : (
                  <Badge
                    className={
                      s.status === "approved"
                        ? "bg-emerald-500/20 text-emerald-400 font-bold"
                        : "bg-rose-500/20 text-rose-400 font-bold"
                    }
                  >
                    {s.status === "approved" ? "APPROVED" : "REJECTED"}
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 🖼️ Actual Uploaded Photo Inspector Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-xl rounded-3xl border border-amber-500/40 bg-[#161618] p-6 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border/50 pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <ImageIcon className="h-5 w-5 text-amber-400" />
                  Uploaded ID Photo — {previewDoc.user_name}
                </h3>
                <p className="text-xs text-muted-foreground font-mono">{previewDoc.user_email} • {previewDoc.document_name}</p>
              </div>

              <button
                onClick={() => setPreviewDoc(null)}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-white/10 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Actual Uploaded Image Display */}
            <div className="rounded-2xl border border-amber-500/30 bg-black p-3 text-center overflow-hidden my-4 min-h-[260px] flex flex-col items-center justify-center">
              {previewDoc.document_url ? (
                <img
                  src={previewDoc.document_url}
                  alt={`ID Document uploaded by ${previewDoc.user_name}`}
                  className="max-h-[360px] w-auto rounded-xl border border-border/40 object-contain shadow-lg"
                />
              ) : (
                <div className="p-8 text-center space-y-2">
                  <FileText className="mx-auto h-12 w-12 text-amber-400" />
                  <p className="text-sm font-bold text-foreground">{previewDoc.document_name}</p>
                  <p className="text-xs text-muted-foreground font-mono">Document uploaded via dashboard form</p>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between border-t border-border/50 pt-4">
              <span className="text-xs font-mono text-muted-foreground">
                Uploaded: {new Date(previewDoc.created_at).toLocaleString()}
              </span>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setPreviewDoc(null)}
                  className="text-xs text-muted-foreground"
                >
                  Close
                </Button>

                {previewDoc.status === "pending" && (
                  <>
                    <Button
                      onClick={() => handleReject(previewDoc.user_id, previewDoc.user_name)}
                      variant="outline"
                      className="border-rose-500/40 text-rose-400 hover:bg-rose-500/10 font-bold text-xs gap-1"
                    >
                      <XCircle className="h-4 w-4" /> Reject ID
                    </Button>

                    <Button
                      onClick={() => handleApprove(previewDoc.user_id, previewDoc.user_name)}
                      className="bg-emerald-500 text-black hover:bg-emerald-400 font-bold text-xs gap-1"
                    >
                      <CheckCircle2 className="h-4 w-4" /> Approve & Verify Player
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </GlassCard>
  );
}
