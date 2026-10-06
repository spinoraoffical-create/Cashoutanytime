"use client";

import { GlassCard } from "@/components/shared/glass-card";
import { Badge } from "@/components/ui/badge";

/** Keys stay in server environment variables. This card never stores or displays them. */
export function AdminNowpaymentsConfigCard() {
  return (
    <GlassCard className="space-y-3 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Crypto payments</h2>
        <Badge variant="outline">NOWPayments</Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        Set <code>NOWPAYMENTS_API_KEY</code> and <code>NOWPAYMENTS_IPN_SECRET</code> on the server.
        The IPN webhook is <code>/api/payments/nowpayments/webhook</code>.
      </p>
    </GlassCard>
  );
}
