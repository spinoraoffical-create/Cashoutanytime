import { getFlaggedFraudUsers } from "@/lib/actions/admin-fraud";
import { AdminFraudList } from "@/components/admin/admin-fraud-list";

export default async function AdminFraudPage() {
  const { users, error } = await getFlaggedFraudUsers();

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold">Fraud &amp; Multi-Account</h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          Review flagged users and restore access for real customers
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <AdminFraudList users={users ?? []} />
    </div>
  );
}
