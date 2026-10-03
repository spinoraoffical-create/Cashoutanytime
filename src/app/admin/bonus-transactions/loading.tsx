import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminBonusTransactionsLoading() {
  return (
    <div>
      <Skeleton className="h-9 w-72 mb-2" />
      <Skeleton className="h-5 w-full max-w-xl mb-8" />
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-5 w-48 mb-2" />
              <Skeleton className="h-4 w-64" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
