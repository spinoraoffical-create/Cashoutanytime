import { VipPageLayout } from "@/components/layout/vip-page-layout";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { vipMetadata } from "@/lib/seo/metadata";
import { VIP_TIERS } from "@/lib/constants";
import Link from "next/link";
import { Crown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const metadata = vipMetadata;

export default function VipPage() {
  return (
    <VipPageLayout>
      <main className="pb-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "VIP Program" }]} />

          <div className="text-center mb-16">
            <Crown className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
            <h1 className="text-4xl font-bold mb-4">
              VIP <span className="gradient-text">Rewards Program</span>
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              Earn points with every game request and referral. Unlock exclusive benefits as you climb from Bronze to Platinum.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            {VIP_TIERS.map((tier) => (
              <Card key={tier.id} className="relative overflow-hidden hover:glow-purple transition-all">
                <div className={cn("absolute top-0 left-0 right-0 h-1 bg-gradient-to-r", tier.color)} />
                <CardHeader>
                  <CardTitle>{tier.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{tier.minPoints}+ points required</p>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {tier.benefits.map((b) => (
                      <li key={b} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="mb-12">
            <CardHeader>
              <CardTitle>How to Earn VIP Points</CardTitle>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-3 gap-6">
              {[
                { action: "Game Account Request", points: 50, progress: 10 },
                { action: "Successful Referral", points: 10, progress: 20 },
                { action: "Monthly Activity Bonus", points: 200, progress: 40 },
              ].map((item) => (
                <div key={item.action}>
                  <div className="flex justify-between text-sm mb-2">
                    <span>{item.action}</span>
                    <span className="text-primary font-semibold">+{item.points} pts</span>
                  </div>
                  <Progress value={item.progress} />
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="text-center">
            <Button size="lg" asChild>
              <Link href="/register">Join VIP Program</Link>
            </Button>
          </div>
        </div>
      </main>
    </VipPageLayout>
  );
}
