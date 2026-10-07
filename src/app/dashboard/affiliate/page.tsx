import { getProfileEditorState } from "@/lib/actions/profile";
import { AffiliatePreview } from "@/components/player/affiliate-preview";

export const metadata = { title: "Affiliate Program | Sweepstakes Hub" };

export default async function AffiliatePage() {
  const profile = await getProfileEditorState();
  const identityReady = profile.kycStatus === "verified" || profile.kycStatus === "approved";
  return (
    <AffiliatePreview
      email={profile.email}
      emailVerified={profile.emailVerified}
      phoneVerified={Boolean(profile.phone)}
      identityVerified={identityReady}
    />
  );
}
