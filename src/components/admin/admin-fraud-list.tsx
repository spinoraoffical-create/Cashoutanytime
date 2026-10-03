"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import {
  blockUserFreeplay,
  clearUserFraudFlags,
  type AdminFraudRow,
} from "@/lib/actions/admin-fraud";
import { MessageCircle, Search, ShieldAlert, ShieldCheck } from "lucide-react";

interface AdminFraudListProps {
  users: AdminFraudRow[];
}

export function AdminFraudList({ users }: AdminFraudListProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.full_name?.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.phone?.toLowerCase().includes(q) ||
        u.user_id.toLowerCase().includes(q)
    );
  }, [users, query]);

  async function handleClear(userId: string) {
    setLoadingId(userId);
    const result = await clearUserFraudFlags(userId);
    setLoadingId(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("User restored — spin rewards enabled");
    router.refresh();
  }

  async function handleBlockFreeplay(userId: string) {
    setLoadingId(userId);
    const result = await blockUserFreeplay(userId);
    setLoadingId(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Freeplay blocked for this user");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, email, phone, or user id..."
          className="pl-9"
        />
      </div>

      <p className="text-sm text-muted-foreground">
        {filtered.length} flagged user{filtered.length === 1 ? "" : "s"}
      </p>

      {filtered.length === 0 ? (
        <Card className="p-8 text-center">
          <ShieldCheck className="h-10 w-10 text-green-500 mx-auto mb-3" />
          <p className="font-medium">No flagged users</p>
          <p className="text-sm text-muted-foreground mt-1">
            Users appear here when multi-account or freeplay rules trigger.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((user) => {
            const busy = loadingId === user.user_id;
            return (
              <Card key={user.user_id}>
                <CardContent className="p-4 flex flex-col gap-4">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-semibold">{user.full_name || "Unnamed"}</h3>
                        <Badge variant="outline">Risk {user.risk_score}</Badge>
                        {user.rewards_blocked && (
                          <Badge variant="destructive">Freeplay blocked</Badge>
                        )}
                        {user.blocked && <Badge variant="destructive">Blocked</Badge>}
                        {user.manual_review && <Badge variant="secondary">Review</Badge>}
                        {user.is_suspended && <Badge variant="destructive">Suspended</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground break-all">{user.email}</p>
                      {user.phone && (
                        <p className="text-sm text-muted-foreground">{user.phone}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        Joined {formatDate(user.created_at)} · {user.device_count} linked device
                        {user.device_count === 1 ? "" : "s"} · Updated{" "}
                        {formatDate(user.last_calculated_at)}
                      </p>
                      {user.flags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {user.flags.map((flag) => (
                            <Badge key={flag} variant="outline" className="text-[10px]">
                              {flag.replace(/_/g, " ")}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 shrink-0">
                      <Button variant="outline" size="sm" asChild className="gap-1.5">
                        <Link href={`/admin/chat?userId=${user.user_id}`}>
                          <MessageCircle className="h-4 w-4" />
                          Message
                        </Link>
                      </Button>
                      <Button
                        size="sm"
                        className="gap-1.5"
                        disabled={busy}
                        onClick={() => handleClear(user.user_id)}
                      >
                        <ShieldCheck className="h-4 w-4" />
                        Restore access
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={busy}
                        onClick={() => handleBlockFreeplay(user.user_id)}
                      >
                        <ShieldAlert className="h-4 w-4" />
                        Block freeplay
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
