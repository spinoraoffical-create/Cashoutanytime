import {
  Award,
  BadgeCheck,
  CalendarCheck,
  CalendarHeart,
  Cherry,
  ConciergeBell,
  Crown,
  Fish,
  Flame,
  Gamepad2,
  Gem,
  Gift,
  Headset,
  Heart,
  Medal,
  MessageCircle,
  Network,
  Rocket,
  Snowflake,
  Spade,
  Sparkles,
  Star,
  TrendingUp,
  Trophy,
  UserCheck,
  UserPlus,
  Users,
  UserStar,
  Zap,
  type LucideIcon,
} from "lucide-react";

/** Resolves icon names stored in the database to Lucide components. */
const ICONS: Record<string, LucideIcon> = {
  award: Award,
  "badge-check": BadgeCheck,
  "calendar-check": CalendarCheck,
  "calendar-heart": CalendarHeart,
  cherry: Cherry,
  "concierge-bell": ConciergeBell,
  crown: Crown,
  fish: Fish,
  flame: Flame,
  "gamepad-2": Gamepad2,
  gem: Gem,
  gift: Gift,
  headset: Headset,
  heart: Heart,
  medal: Medal,
  "message-circle": MessageCircle,
  network: Network,
  rocket: Rocket,
  snowflake: Snowflake,
  spade: Spade,
  sparkles: Sparkles,
  star: Star,
  "trending-up": TrendingUp,
  trophy: Trophy,
  "user-check": UserCheck,
  "user-plus": UserPlus,
  users: Users,
  "user-star": UserStar,
  zap: Zap,
};

export function DynamicIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Icon = ICONS[name] ?? Trophy;
  return <Icon className={className} aria-hidden />;
}
