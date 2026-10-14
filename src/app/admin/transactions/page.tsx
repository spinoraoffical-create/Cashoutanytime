import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminTransactionsLive } from "@/components/admin/admin-transactions-live";

export default function AdminTransactionsPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <AdminPageHeader
        title="Transaction history"
        description="Search one player to see stored Total Deposit and Deposit Redeem rows. The list includes money loads and redeems. It leaves out account creation. The figures update live and are not a profit total."
      />

      <AdminTransactionsLive lazy />
    </div>
  );
}
