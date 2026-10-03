import { Skeleton } from "@/components/ui/skeleton";

export default function SpinLoading() {
  return (
    <div className="min-h-screen bg-[#121212] pt-20 pb-12 px-4 animate-pulse">
      <div className="max-w-lg mx-auto text-center space-y-6">
        <Skeleton className="h-8 w-48 mx-auto" />
        <Skeleton className="aspect-square w-full max-w-sm mx-auto rounded-full" />
        <Skeleton className="h-12 w-40 mx-auto rounded-xl" />
      </div>
    </div>
  );
}
