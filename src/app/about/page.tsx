import { VipPageLayout } from "@/components/layout/vip-page-layout";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { Card, CardContent } from "@/components/ui/card";
import { aboutMetadata } from "@/lib/seo/metadata";
import { Shield, Headphones, Zap, Users } from "lucide-react";

export const metadata = aboutMetadata;

const values = [
  { icon: Shield, title: "Trusted & Secure", description: "Your accounts and data are protected with enterprise-grade security and encrypted communications." },
  { icon: Headphones, title: "24/7 Support", description: "Our expert support team is available around the clock via live chat to assist with any questions." },
  { icon: Zap, title: "Fast Setup", description: "Get your game accounts set up quickly with our streamlined request and approval process." },
  { icon: Users, title: "Community Driven", description: "Join thousands of players who trust Spinora for premium gaming support and VIP rewards." },
];

export default function AboutPage() {
  return (
    <VipPageLayout>
      <main className="pb-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "About" }]} />

          <div className="mb-16">
            <h1 className="text-4xl font-bold mb-4">
              About <span className="gradient-text">Spinora</span>
            </h1>
            <p className="text-muted-foreground max-w-3xl text-lg leading-relaxed">
              Spinora is a premium gaming support and account platform built for players who demand the best. We provide instant access to popular gaming platforms, VIP reward programs, and dedicated 24/7 live chat support.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-6 mb-16">
            {values.map((value) => {
              const Icon = value.icon;
              return (
                <Card key={value.title}>
                  <CardContent className="p-6">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{value.title}</h3>
                    <p className="text-sm text-muted-foreground">{value.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card>
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold mb-4">Our Mission</h2>
              <p className="text-muted-foreground leading-relaxed">
                We believe every gamer deserves premium support and seamless access to their favorite platforms. Spinora was founded to bridge the gap between players and gaming platforms, offering a trusted, transparent, and rewarding experience. From account requests to VIP perks and referral bonuses, we are committed to elevating your gaming journey.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </VipPageLayout>
  );
}
