import type { Metadata } from "next";
import Link from "next/link";
import { Mail, MessageCircle, Clock } from "lucide-react";

import { VipPageLayout } from "@/components/layout/vip-page-layout";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Contact | Spinora",
  description: "Reach Spinora support for deposits, game accounts, and VIP questions.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <VipPageLayout>
      <main className="pb-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Contact" }]} />

          <div className="mb-12 max-w-2xl">
            <h1 className="text-4xl font-bold mb-4">
              Contact <span className="gradient-text">Spinora</span>
            </h1>
            <p className="text-muted-foreground text-lg">
              24/7 support for deposits, game accounts, and VIP questions.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-6 mb-12">
            {[
              { icon: MessageCircle, title: "Live Chat", desc: "Signed in? Open messages from your dashboard.", action: "Open Messages", href: "/dashboard/messages" },
              { icon: Mail, title: "Email", desc: "support@spinoracasinos.com", action: "Send Email", href: "mailto:support@spinoracasinos.com" },
              { icon: Clock, title: "Response Time", desc: "Average response under 5 minutes.", action: "Help Center", href: "/support" },
            ].map(({ icon: Icon, title, desc, action, href }) => (
              <Card key={title} className="hover:glow-purple transition-all">
                <CardHeader>
                  <div className="w-12 h-12 rounded-xl gradient-bg flex items-center justify-center mb-2">
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-lg">{title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">{desc}</p>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={href}>{action}</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </VipPageLayout>
  );
}
