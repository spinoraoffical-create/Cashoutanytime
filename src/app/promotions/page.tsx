import { VipPageLayout } from "@/components/layout/vip-page-layout";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { promotionsMetadata } from "@/lib/seo/metadata";
import { getActivePromotions } from "@/lib/data/promotions-public";
import Link from "next/link";
import { Gift } from "lucide-react";

export const metadata = promotionsMetadata;

export default async function PromotionsPage() {
  const promotions = await getActivePromotions();

  return (
    <VipPageLayout>
      <main className="pb-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Promotions" }]} />

          <div className="mb-12">
            <h1 className="text-4xl font-bold mb-4">
              Promotions & <span className="gradient-text">Bonuses</span>
            </h1>
            <p className="text-muted-foreground max-w-2xl text-lg">
              Live offers from Spinora — updated from the admin panel.
            </p>
          </div>

          {promotions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No active promotions right now. Check back soon or create offers in the admin panel.
              </CardContent>
            </Card>
          ) : (
            <div className="grid sm:grid-cols-2 gap-6">
              {promotions.map((promo) => (
                <Card key={promo.id} className="hover:glow-purple transition-all">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div className="w-12 h-12 rounded-xl gradient-bg flex items-center justify-center shrink-0">
                        <Gift className="h-6 w-6 text-white" />
                      </div>
                      {promo.badge_text && (
                        <Badge variant="default">{promo.badge_text}</Badge>
                      )}
                    </div>
                    <CardTitle className="mt-4">{promo.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      {promo.summary || promo.description}
                    </p>
                    {promo.code && (
                      <p className="text-xs font-mono text-orange-400 mb-4">Code: {promo.code}</p>
                    )}
                    <Button size="sm" asChild>
                      <Link href="/register">Get Started</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </VipPageLayout>
  );
}
