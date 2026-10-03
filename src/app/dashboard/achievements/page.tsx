import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getAchievements } from "@/lib/data/dashboard";
import { Trophy } from "lucide-react";

const RARITY: Record<string, string> = {
  common: "bg-muted text-muted-foreground",
  rare: "bg-blue-500/15 text-blue-400",
  epic: "bg-purple-500/15 text-purple-400",
  legendary: "bg-amber-500/15 text-amber-400",
};

export default async function DashboardAchievementsPage() {
  const achievements = await getAchievements();

  return (
    <div>
      <DashboardPageHeader
        title="Achievements"
        description="Unlock badges by playing, referring friends, and staying active."
      />

      {achievements.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Achievements will appear here once configured in admin.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {achievements.map((a) => {
            const unlocked = Boolean(a.unlocked_at);
            const pct = a.condition_value
              ? Math.min(100, Math.round((a.progress / a.condition_value) * 100))
              : unlocked
                ? 100
                : 0;
            return (
              <Card key={a.id} className={unlocked ? "border-orange-500/30" : "opacity-90"}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <Trophy className={`h-5 w-5 shrink-0 ${unlocked ? "text-orange-400" : "text-muted-foreground"}`} />
                    <Badge className={RARITY[a.rarity] ?? RARITY.common}>{a.rarity}</Badge>
                  </div>
                  <CardTitle className="text-base">{a.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{a.description}</p>
                </CardHeader>
                <CardContent>
                  <div className="h-2 rounded-full bg-muted overflow-hidden mb-2">
                    <div
                      className="h-full bg-orange-500 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {unlocked
                      ? `Unlocked ${new Date(a.unlocked_at!).toLocaleDateString()}`
                      : `${a.progress}/${a.condition_value} progress`}
                    {(a.coins_reward > 0 || a.xp_reward > 0) && (
                      <span>
                        {" "}
                        · +{a.coins_reward} coins / +{a.xp_reward} XP
                      </span>
                    )}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
