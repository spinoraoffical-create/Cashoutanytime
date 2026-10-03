import { Suspense } from "react";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

import { AdminLayoutGate } from "@/components/admin/admin-layout-gate";
import { AdminLayoutSkeleton } from "@/components/admin/admin-layout-skeleton";
import AdminLoading from "./loading";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Spinora Admin" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<AdminLayoutSkeleton />}>
      <AdminLayoutGate>
        <Suspense fallback={<AdminLoading />}>{children}</Suspense>
      </AdminLayoutGate>
    </Suspense>
  );
}
