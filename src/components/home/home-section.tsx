import { cn } from "@/lib/utils";

interface HomeSectionProps {
  children: React.ReactNode;
  className?: string;
  tinted?: boolean;
}

/** Full-width block inside the main column — no extra max-width centering */
export function HomeSection({ children, className, tinted = false }: HomeSectionProps) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-white/5 p-6 sm:p-8 lg:p-10 w-full",
        tinted && "bg-[#181818]/80",
        className
      )}
    >
      {children}
    </section>
  );
}
