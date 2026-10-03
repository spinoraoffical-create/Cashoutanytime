import { cn } from "@/lib/utils";

interface UnreadBadgeProps {
  count: number;
  className?: string;
  dotOnly?: boolean;
}

export function UnreadBadge({ count, className, dotOnly = false }: UnreadBadgeProps) {
  if (count <= 0) return null;

  if (dotOnly) {
    return (
      <span
        className={cn(
          "shrink-0 w-2 h-2 rounded-full bg-red-500 ring-2 ring-[#161616]",
          className
        )}
        aria-label={`${count} unread messages`}
      />
    );
  }

  return (
    <span
      className={cn(
        "shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center",
        className
      )}
      aria-label={`${count} unread messages`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
