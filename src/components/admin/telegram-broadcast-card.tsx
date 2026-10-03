"use client";

import { useState, useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/shared/glass-card";
import { toast } from "sonner";
import { Send, Sparkles, Image as ImageIcon, CheckCircle2, Copy, RefreshCw } from "lucide-react";

interface TelegramPreset {
  dayName: string;
  name: string;
  category: string;
  imageUrl: string;
  captionTemplate: (dateStr: string, siteUrl: string) => string;
}

function getFormattedDate(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function buildWeeklyPosters(siteUrl: string): TelegramPreset[] {
  const dash = `${siteUrl}/dashboard`;
  return [
    {
      dayName: "Sunday",
      name: "🎁 Sunday Funday — $3 Gift Drop",
      category: "SUNDAY",
      imageUrl: "/images/promos/spinora_gift_three.jpg",
      captionTemplate: (dateStr) =>
        `🎁 <b>SUNDAY FUNDAY — GET $3 FREE PLAY!</b>\n🗓️ <b>Official Offer • ${dateStr}</b>\n\nLog in today to spin our 24-Hour Wheel of Fortune & claim $3 Free Play credits on all 8 game platforms!\n\n✨ <b>Sunday Perks:</b>\n• $3 Instant Free Bonus\n• 24/7 Automated Bot Account Setup\n• Fast 15-Minute Cashouts\n\n👉 <a href="${dash}">Claim $3 Free Play & Play Now</a>`,
    },
    {
      dayName: "Monday",
      name: "🃏 Monday Kickoff — $10 Dealer Special",
      category: "MONDAY",
      imageUrl: "/images/promos/spinora_dealer_ten.jpg",
      captionTemplate: (dateStr) =>
        `👑 <b>MONDAY KICKOFF — GET $10 FREE PLAY!</b>\n🗓️ <b>Official Offer • ${dateStr}</b>\n\nYour Luck, Your Win! Start your week with $10 Free Play on Juwa 777, Game Vault, and Fire Kirin.\n\n✨ <b>Monday Booster:</b>\n• $10 Instant Free Play Credit\n• 100% Instant Deposit Match\n• Cash App, USDT, Zelle Accepted\n\n👉 <a href="${dash}">Claim $10 Free Play & Start Week</a>`,
    },
    {
      dayName: "Tuesday",
      name: "💃 Tuesday Reload — $5 Glamour Special",
      category: "TUESDAY",
      imageUrl: "/images/promos/spinora_model_five.jpg",
      captionTemplate: (dateStr) =>
        `👑 <b>TUESDAY RELOAD — GET $5 FREE PLAY!</b>\n🗓️ <b>Official Offer • ${dateStr}</b>\n\nBig Wins Await You! Claim $5 Free Play with 24/7 instant game account loads.\n\n✨ <b>Tuesday Highlights:</b>\n• $5 Free Play Credits\n• High RTP Slot Rooms\n• Fast & Easy Registration\n\n👉 <a href="${dash}">Claim $5 Free Play & Win Big</a>`,
    },
    {
      dayName: "Wednesday",
      name: "🎰 Midweek Jackpot — $15 777 Slot",
      category: "WEDNESDAY",
      imageUrl: "/images/promos/spinora_slot_fifteen.jpg",
      captionTemplate: (dateStr) =>
        `🎰 <b>MIDWEEK 777 JACKPOT — GET $15 FREE PLAY!</b>\n🗓️ <b>Official Offer • ${dateStr}</b>\n\nClassic 777 Slot Machine rooms are dropping huge multipliers today!\n\n✨ <b>Claim Details:</b>\n• $15 Free Play Bonus\n• 100% Instant Deposit Match\n• 24/7 Bot Automated Wallet Loads\n\n👉 <a href="${dash}">Claim $15 Free Play & Spin 777</a>`,
    },
    {
      dayName: "Thursday",
      name: "🎁 Thursday Freeplay — $3 Gift Drop",
      category: "THURSDAY",
      imageUrl: "/images/promos/spinora_gift_three.jpg",
      captionTemplate: (dateStr) =>
        `🎁 <b>THURSDAY FREEPLAY DROP — $3 BONUS!</b>\n🗓️ <b>Official Offer • ${dateStr}</b>\n\nStep 1: Visit our site & message chat\nStep 2: You're in! Get started with $3 Free Play!\n\n✨ <b>Thursday Perks:</b>\n• $3 Instant Free Bonus\n• Exciting Fish & Slot Games\n• Fast 15-Minute Cashouts\n\n👉 <a href="${dash}">Claim Your $3 Free Play Now</a>`,
    },
    {
      dayName: "Friday",
      name: "🔥 Friday Night Rush — $10 Dealer Special",
      category: "FRIDAY",
      imageUrl: "/images/promos/spinora_dealer_ten.jpg",
      captionTemplate: (dateStr) =>
        `⚡ <b>FRIDAY NIGHT RUSH — GET $10 FREE PLAY!</b>\n🗓️ <b>Official Offer • ${dateStr}</b>\n\nKick off your weekend with $10 Free Play & double deposit matches all night long!\n\n✨ <b>Friday Night VIP Perks:</b>\n• $10 Instant Free Play Credit\n• 100% Reload Match Active\n• Guaranteed 15-Minute Payouts\n\n👉 <a href="${dash}">Claim $10 Bonus & Win Tonight</a>`,
    },
    {
      dayName: "Saturday",
      name: "💃 Saturday Super Match — $5 Glamour Special",
      category: "SATURDAY",
      imageUrl: "/images/promos/spinora_model_five.jpg",
      captionTemplate: (dateStr) =>
        `👑 <b>SATURDAY SUPER MATCH — GET $5 FREE PLAY!</b>\n🗓️ <b>Official Offer • ${dateStr}</b>\n\nWeekend Jackpots are Live! Claim $5 Free Play and enter our weekend $50 cash raffle.\n\n✨ <b>Saturday Highlights:</b>\n• $5 Free Play Bonus\n• 1 Free Raffle Entry per Deposit\n• 24/7 Bot Wallet Loads\n\n👉 <a href="${dash}">Claim $5 Free Play & Join Raffle</a>`,
    },
  ];
}

export function TelegramBroadcastCard({
  siteUrl,
  promoChatIdPresent,
}: {
  siteUrl: string;
  promoChatIdPresent?: boolean;
}) {
  const weeklyPosters = useMemo(() => buildWeeklyPosters(siteUrl), [siteUrl]);

  const [currentDateStr, setCurrentDateStr] = useState("");
  const [currentDayName, setCurrentDayName] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<TelegramPreset>(weeklyPosters[0]);
  const [caption, setCaption] = useState("");
  const [imageUrl, setImageUrl] = useState(weeklyPosters[0].imageUrl);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const todayStr = getFormattedDate();
    const todayDayName = new Date().toLocaleDateString("en-US", { weekday: "long" });
    setCurrentDateStr(todayStr);
    setCurrentDayName(todayDayName);

    const todayPoster =
      weeklyPosters.find((p) => p.dayName.toLowerCase() === todayDayName.toLowerCase()) ||
      weeklyPosters[0];

    setSelectedPreset(todayPoster);
    setImageUrl(todayPoster.imageUrl);
    setCaption(todayPoster.captionTemplate(todayStr, siteUrl));
  }, [weeklyPosters, siteUrl]);

  function applyPreset(p: TelegramPreset) {
    setSelectedPreset(p);
    setCaption(p.captionTemplate(currentDateStr || getFormattedDate(), siteUrl));
    setImageUrl(p.imageUrl);
    toast.info(`Loaded poster for ${p.dayName}.`);
  }

  function handleCopyCaption() {
    navigator.clipboard.writeText(caption);
    toast.success("Caption copied to clipboard.");
  }

  function handleCopyImageLink() {
    const full = imageUrl.startsWith("http") ? imageUrl : `${siteUrl}${imageUrl}`;
    navigator.clipboard.writeText(full);
    toast.success("Poster image URL copied.");
  }

  async function handleSendBroadcast() {
    if (!promoChatIdPresent) {
      toast.error("TELEGRAM_PROMO_CHAT_ID is not configured.");
      return;
    }

    setSending(true);

    try {
      const fullImageUrl = imageUrl.startsWith("http") ? imageUrl : `${siteUrl}${imageUrl}`;
      const res = await fetch("/api/admin/telegram-broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: caption,
          imageUrl: fullImageUrl,
        }),
      });

      const data = await res.json();
      setSending(false);

      if (!res.ok || !data.ok) {
        toast.error(data.error || "Broadcast failed.");
        return;
      }

      toast.success(data.message || `${currentDayName} poster sent to Telegram.`);
    } catch {
      setSending(false);
      toast.error("Network error sending broadcast.");
    }
  }

  return (
    <GlassCard className="p-6 border-sky-500/30 bg-background/80">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border/50 pb-4 mb-6 gap-2">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-sky-400" />
            Daily Poster Broadcast (Live Send)
          </h2>
          <p className="text-xs text-muted-foreground">
            Sends immediately to your promo channel via Telegram API. Links use{" "}
            <span className="font-mono text-sky-300">{siteUrl}</span>.
          </p>
        </div>
        <Badge className="bg-amber-500/20 text-amber-400 font-mono shrink-0">
          TODAY: {currentDateStr || "..."}
        </Badge>
      </div>

      <div className="mb-6 rounded-xl border border-sky-500/30 bg-sky-500/5 p-4">
        <div className="flex items-center justify-between mb-2.5">
          <p className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> 7-Day Weekly Poster Calendar
          </p>
          <Badge className="bg-sky-500 text-black text-[10px] font-bold">
            AUTO TODAY: {currentDayName.toUpperCase()}
          </Badge>
        </div>

        <div className="grid gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {weeklyPosters.map((p) => {
            const isToday = p.dayName.toLowerCase() === currentDayName.toLowerCase();
            return (
              <button
                key={p.dayName}
                type="button"
                onClick={() => applyPreset(p)}
                className={`rounded-xl border p-2 text-left transition-all flex flex-col justify-between ${
                  selectedPreset.dayName === p.dayName
                    ? "bg-amber-500/20 border-amber-400 font-bold ring-2 ring-amber-500/50"
                    : "border-border/60 bg-background/80 hover:bg-sky-500/10"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold text-sky-300">{p.dayName}</span>
                  {isToday && (
                    <span className="text-[9px] bg-amber-500 text-black font-extrabold px-1 rounded">
                      TODAY
                    </span>
                  )}
                </div>
                <img
                  src={p.imageUrl}
                  alt={p.name}
                  className="w-full h-24 object-cover rounded border border-border/40 mb-1"
                />
                <span className="text-[10px] text-muted-foreground truncate">
                  {p.name.split("—")[1] || p.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase text-foreground mb-1">
              Poster Image Path
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleCopyImageLink}
                className="shrink-0 text-xs font-bold gap-1 border-sky-500/40 text-sky-300"
              >
                <Copy className="h-3.5 w-3.5" /> Copy URL
              </Button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold uppercase text-foreground">Caption</label>
              <button
                type="button"
                onClick={handleCopyCaption}
                className="text-[11px] text-amber-400 hover:underline font-bold flex items-center gap-1"
              >
                <Copy className="h-3 w-3" /> Copy
              </button>
            </div>
            <textarea
              rows={8}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="w-full rounded-lg border border-border bg-background/60 p-3 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <Button
              onClick={() => void handleSendBroadcast()}
              disabled={sending}
              className="w-full sm:w-auto bg-sky-500 text-black hover:bg-sky-400 font-bold py-5 rounded-xl text-sm gap-2 flex-1"
            >
              <Send className="h-4 w-4" />
              {sending ? "Sending..." : `Send ${currentDayName}'s Poster Now`}
            </Button>

            <Button
              onClick={handleCopyCaption}
              variant="outline"
              className="w-full sm:w-auto border-amber-500/40 text-amber-300 hover:bg-amber-500/10 font-bold py-5 rounded-xl text-sm gap-2"
            >
              <Copy className="h-4 w-4" /> Copy for Manual Post
            </Button>
          </div>

          {!promoChatIdPresent && (
            <p className="text-xs text-amber-400 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Set TELEGRAM_PROMO_CHAT_ID in env to enable live sends.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase text-foreground flex items-center gap-1.5">
            <ImageIcon className="h-3.5 w-3.5 text-sky-400" /> Preview ({currentDayName})
          </label>

          <div className="rounded-2xl border border-sky-500/30 bg-[#17212b] p-4 text-white shadow-xl space-y-3">
            <div className="flex items-center gap-2 border-b border-white/10 pb-2">
              <div className="h-8 w-8 rounded-full bg-amber-500 flex items-center justify-center font-black text-black text-xs">
                👑
              </div>
              <div>
                <span className="text-xs font-bold block">Spinora Royale VIP Channel</span>
                <span className="text-[10px] text-sky-400 font-mono">Live preview</span>
              </div>
            </div>

            {imageUrl && (
              <div className="rounded-xl overflow-hidden border border-white/10 bg-black">
                <img src={imageUrl} alt="Poster preview" className="w-full h-80 object-cover" />
              </div>
            )}

            <div
              className="text-xs space-y-2 leading-relaxed font-sans text-slate-200"
              dangerouslySetInnerHTML={{ __html: caption.replace(/\n/g, "<br/>") }}
            />
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
