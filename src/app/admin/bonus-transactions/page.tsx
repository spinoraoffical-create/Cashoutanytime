import { redirect } from "next/navigation";

/** Old URL — use Transaction Management instead. */
export default function AdminBonusTransactionsRedirect() {
  redirect("/admin/transactions?wallet=bonus");
}
