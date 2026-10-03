import type { Metadata } from "next";
import { getPlayerKYCStatus } from "@/lib/actions/kyc-actions";
import { KYCVerificationCard } from "@/components/dashboard/kyc-verification-card";

export const metadata: Metadata = {
  title: "KYC Account Verification",
};

export default async function DashboardKYCPage() {
  const currentStatus = await getPlayerKYCStatus();

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-black text-foreground">🛡️ KYC Account & Age Verification</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload your Government ID or Driver's License to verify your age (18+) and unlock fast 15-minute cashouts.
        </p>
      </div>

      <KYCVerificationCard initialStatus={currentStatus} />
    </div>
  );
}
