"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { SITE_URL } from "@/lib/constants";

interface ReferralShareProps {
  code: string;
}

export function ReferralShare({ code }: ReferralShareProps) {
  const [copied, setCopied] = useState(false);
  const link = `${SITE_URL}/register?ref=${code}`;

  async function copyLink() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success("Referral link copied!");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Your Referral Code</p>
      <p className="text-2xl font-bold gradient-text">{code}</p>
      <div className="flex gap-2">
        <Input value={link} readOnly className="text-xs" />
        <Button size="icon" variant="outline" onClick={copyLink}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
