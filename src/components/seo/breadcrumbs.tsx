import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { BreadcrumbSchema } from "@/lib/seo/json-ld";
import { SITE_URL } from "@/lib/constants";

interface BreadcrumbItem {
  name: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  const schemaItems = items.map((item) => ({
    name: item.name,
    url: item.href ? `${SITE_URL}${item.href}` : SITE_URL,
  }));

  return (
    <>
      <BreadcrumbSchema items={schemaItems} />
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-muted-foreground mb-6">
        {items.map((item, i) => (
          <span key={item.name} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3" />}
            {item.href ? (
              <Link href={item.href} className="hover:text-foreground transition-colors">
                {item.name}
              </Link>
            ) : (
              <span className="text-foreground">{item.name}</span>
            )}
          </span>
        ))}
      </nav>
    </>
  );
}
