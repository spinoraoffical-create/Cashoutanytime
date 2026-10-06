import Link from "next/link";
import { PlayerSubpage } from "@/components/player/player-subpage";
import { getProfileEditorState } from "@/lib/actions/profile";

export default async function VerificationPage() {
  const profile = await getProfileEditorState();
  const emailDone = profile.emailVerified;
  const phoneDone = Boolean(profile.phone);
  const idDone = profile.kycStatus === "verified" || profile.kycStatus === "approved";
  const done = Number(emailDone) + Number(phoneDone) + Number(idDone);

  const rows = [
    { title: "Email", state: emailDone ? "Verified" : "Needed", href: "/dashboard/welcome", cta: emailDone ? "View" : "Verify" },
    { title: "Phone", state: phoneDone ? "Saved" : "Needed", href: "/dashboard/welcome", cta: phoneDone ? "View" : "Add phone" },
    { title: "Photo ID", state: idDone ? "Verified" : profile.kycStatus === "pending" ? "Pending" : "Not started", href: "/dashboard/kyc", cta: idDone ? "View" : "Verify ID" },
  ];

  return (
    <PlayerSubpage title="Verification" subtitle={`${done} of 3 verified. Finish this to keep cash-outs moving.`}>
      <div className="hub-card divide-y divide-white/8 rounded-[24px]">
        {rows.map((row) => (
          <Link key={row.title} href={row.href} className="flex items-center justify-between gap-3 p-4">
            <div>
              <p className="font-bold">{row.title}</p>
              <p className="text-xs text-zinc-400">{row.state}</p>
            </div>
            <span className="rounded-full bg-white/8 px-3 py-1.5 text-xs font-bold">{row.cta}</span>
          </Link>
        ))}
      </div>
    </PlayerSubpage>
  );
}
