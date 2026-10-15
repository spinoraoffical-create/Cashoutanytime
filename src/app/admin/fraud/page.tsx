import { getFlaggedFraudUsers } from "@/lib/actions/admin-fraud";
import { AdminFraudList } from "@/components/admin/admin-fraud-list";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminErrorState } from "@/components/admin/ui/admin-error-state";
import { requireSuperAdmin } from "@/lib/data/admin";

export default async function AdminFraudPage() {
  await requireSuperAdmin();
  const { users, error } = await getFlaggedFraudUsers();

  return (
    <div className="mx-auto max-w-7xl">
      <AdminPageHeader
        title="Fraud flags"
        description="Players already flagged by the existing rules. Restore access and Block freeplay still ask you to confirm, and each one writes an audit entry."
      />

      {error ? <AdminErrorState title="The fraud list could not be loaded" body={error} /> : null}

      <AdminFraudList users={users ?? []} />
    </div>
  );
}
