import { AdminTransactionsLive } from "@/components/admin/admin-transactions-live";

export default function AdminTransactionsPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold">Transaction Management</h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          Pick one user — see their <strong className="text-foreground font-medium">Total Deposit</strong>{" "}
          and <strong className="text-foreground font-medium">Deposit Redeem</strong> history.
          Only money loads & redeems (not account creation). Updates live.
        </p>
      </div>

      <AdminTransactionsLive lazy />
    </div>
  );
}
