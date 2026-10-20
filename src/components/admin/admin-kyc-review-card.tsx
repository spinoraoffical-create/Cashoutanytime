"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCircle2, Eye, FileText, X, XCircle } from "lucide-react";
import { KYCSubmissionRecord, updateKYCStatus } from "@/lib/actions/kyc-actions";
import { applyReviewDecision, reviewCounts } from "@/lib/kyc/decision";
import { formatNepalTime } from "@/lib/admin/nepal-time";
import { AdminEmptyState } from "@/components/admin/ui/admin-empty-state";
import { AdminSectionCard } from "@/components/admin/ui/admin-section-card";
import { AdminStatusBadge } from "@/components/admin/ui/admin-status-badge";

const FILTERS = ["all", "pending", "approved", "rejected"] as const;
type Filter = (typeof FILTERS)[number];

const FILTER_LABEL: Record<Filter, string> = {
  all: "All",
  pending: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
};

export function AdminKYCReviewCard({
  initialSubmissions = [],
}: {
  initialSubmissions?: KYCSubmissionRecord[];
}) {
  const [submissions, setSubmissions] = useState<KYCSubmissionRecord[]>(initialSubmissions);
  const [previewDoc, setPreviewDoc] = useState<KYCSubmissionRecord | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [savingId, setSavingId] = useState<string | null>(null);

  async function handleApprove(userId: string, name: string) {
    if (savingId) return;
    if (!window.confirm(`Approve the identity check for ${name}?`)) return;
    setSavingId(userId);
    const res = await updateKYCStatus(userId, "approved");
    setSavingId(null);
    if (res.ok) {
      setSubmissions((prev) => applyReviewDecision(prev, userId, "approved"));
      toast.success("Identity verification approved.");
      setPreviewDoc(null);
    } else {
      toast.error(res.error || "The identity status could not be saved.");
    }
  }

  async function handleReject(userId: string, name: string) {
    if (savingId) return;
    if (!window.confirm(`Reject the identity check for ${name}?`)) return;
    setSavingId(userId);
    const res = await updateKYCStatus(userId, "rejected");
    setSavingId(null);
    if (res.ok) {
      setSubmissions((prev) => applyReviewDecision(prev, userId, "rejected"));
      toast.success("Identity verification rejected.");
      setPreviewDoc(null);
    } else {
      toast.error(res.error || "The identity status could not be saved.");
    }
  }

  const visible = filter === "all" ? submissions : submissions.filter((s) => s.status === filter);
  const counts = reviewCounts(submissions);

  return (
    <AdminSectionCard
      title="Identity checks"
      description="These are the checks already stored. The list filter only hides rows on this screen. Approve and Reject still use the existing review action, and each one asks you to confirm."
    >
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={
              filter === key
                ? "rounded-full bg-gradient-to-r from-[#6d28d9] to-[#2563eb] px-3 py-1.5 text-xs font-semibold text-white"
                : "rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-[#9fb0d0]"
            }
          >
            {FILTER_LABEL[key]} ({counts[key]})
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <AdminEmptyState
          title={submissions.length === 0 ? "No identity checks yet" : "Nothing in this view"}
          body={
            submissions.length === 0
              ? "When a player uploads an ID, it will show here for review."
              : "Choose All to see every check already loaded."
          }
        />
      ) : (
        <ul className="space-y-3">
          {visible.map((s) => (
            <li
              key={s.id}
              className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-[#0c1224] p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-white">{s.user_name}</p>
                  <AdminStatusBadge status={s.status} />
                </div>
                <p className="mt-1 break-all text-xs text-[#9fb0d0]">{s.user_email}</p>
                <p className="mt-1 text-xs text-[#8ea0c3]">
                  {s.document_name} · {formatNepalTime(s.created_at)}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPreviewDoc(s)}
                  className="gap-1 border-white/15 text-[#e8eefc]"
                >
                  <Eye className="h-3.5 w-3.5" /> View photo
                </Button>

                {s.status === "pending" ? (
                  <>
                    <Button
                      size="sm"
                      disabled={savingId === s.user_id}
                      onClick={() => handleApprove(s.user_id, s.user_name)}
                      className="gap-1 bg-emerald-500 text-black hover:bg-emerald-400"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={savingId === s.user_id}
                      onClick={() => handleReject(s.user_id, s.user_name)}
                      className="gap-1 border-rose-400/40 text-rose-200 hover:bg-rose-500/10"
                    >
                      <XCircle className="h-3.5 w-3.5" /> Reject
                    </Button>
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {previewDoc ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-label={`Uploaded ID photo for ${previewDoc.user_name}`}>
          <div className="relative w-full max-w-xl rounded-3xl border border-[#7c3aed]/35 bg-[#0d1428] p-6 shadow-[0_18px_40px_rgba(76,29,149,0.28)]">
            <div className="mb-4 flex items-start justify-between gap-3 border-b border-white/10 pb-3">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-white">Uploaded ID photo — {previewDoc.user_name}</h3>
                <p className="mt-1 break-all text-xs text-[#9fb0d0]">
                  {previewDoc.user_email} · {previewDoc.document_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="rounded-full p-1.5 text-[#9fb0d0] hover:bg-white/10 hover:text-white"
                aria-label="Close photo"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="my-4 flex min-h-[260px] flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black p-3 text-center">
              {previewDoc.document_url ? (
                <img
                  src={previewDoc.document_url}
                  alt={`ID document uploaded by ${previewDoc.user_name}`}
                  className="max-h-[360px] w-auto rounded-xl object-contain"
                />
              ) : (
                <div className="space-y-2 p-8 text-center">
                  <FileText className="mx-auto h-12 w-12 text-[#c4b5fd]" />
                  <p className="text-sm font-semibold text-white">{previewDoc.document_name}</p>
                  <p className="text-xs text-[#9fb0d0]">The stored photo link is empty for this check.</p>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs text-[#8ea0c3]">Uploaded {formatNepalTime(previewDoc.created_at)}</span>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={() => setPreviewDoc(null)} className="border-white/15 text-[#e8eefc]">
                  Close
                </Button>
                {previewDoc.status === "pending" ? (
                  <>
                    <Button
                      onClick={() => handleReject(previewDoc.user_id, previewDoc.user_name)}
                      variant="outline"
                      disabled={savingId === previewDoc.user_id}
                      className="gap-1 border-rose-400/40 text-rose-200 hover:bg-rose-500/10"
                    >
                      <XCircle className="h-4 w-4" /> Reject
                    </Button>
                    <Button
                      onClick={() => handleApprove(previewDoc.user_id, previewDoc.user_name)}
                      disabled={savingId === previewDoc.user_id}
                      className="gap-1 bg-emerald-500 text-black hover:bg-emerald-400"
                    >
                      <CheckCircle2 className="h-4 w-4" /> Approve
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </AdminSectionCard>
  );
}
