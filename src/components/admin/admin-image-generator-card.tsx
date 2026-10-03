"use client";

import { useRef, useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/shared/glass-card";
import { toast } from "sonner";
import { Sparkles, Download, Image as ImageIcon, Wand2, RefreshCw } from "lucide-react";

interface SpinoraPosterPreset {
  id: string;
  name: string;
  badgeSubtitle: string;
  offerAmount: string;
  characterType: "dealer" | "woman" | "slot777" | "giftbox" | "phone";
  glowColor: string;
}

const SPINORA_POSTER_PRESETS: SpinoraPosterPreset[] = [
  { id: "p10", name: "🃏 $10 Free Play Dealer Special", badgeSubtitle: "YOUR LUCK, YOUR WIN!", offerAmount: "GET $10 FREE PLAY", characterType: "dealer", glowColor: "#00f0ff" },
  { id: "p5", name: "💃 $5 Free Play Glamour Special", badgeSubtitle: "YOUR LUCK, YOUR WIN!", offerAmount: "GET $5 FREE PLAY", characterType: "woman", glowColor: "#ec4899" },
  { id: "p15", name: "🎰 $15 Free Play 777 Jackpot", badgeSubtitle: "YOUR LUCK, YOUR WIN!", offerAmount: "GET $15 FREE PLAY", characterType: "slot777", glowColor: "#f59e0b" },
  { id: "p3_gift", name: "🎁 $3 Free Play Gift Drop", badgeSubtitle: "GET EXCITED TO PLAY!", offerAmount: "CHANCE TO WIN $3 FREE PLAY!", characterType: "giftbox", glowColor: "#10b981" },
  { id: "p3_glam", name: "🔥 $3 Free Play Glamour Special", badgeSubtitle: "YOUR LUCK, YOUR WIN!", offerAmount: "GET $3 FREE PLAY", characterType: "woman", glowColor: "#8b5cf6" },
];

export function AdminImageGeneratorCard() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [preset, setPreset] = useState<SpinoraPosterPreset>(SPINORA_POSTER_PRESETS[0]);
  const [offerText, setOfferText] = useState(SPINORA_POSTER_PRESETS[0].offerAmount);
  const [dateText, setDateText] = useState("");
  const [domainText, setDomainText] = useState("spinoracasinos.com");

  useEffect(() => {
    const today = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    setDateText(today);
  }, []);

  useEffect(() => {
    setOfferText(preset.offerAmount);
  }, [preset]);

  useEffect(() => {
    renderOfficialSpinoraPoster();
  }, [preset, offerText, dateText, domainText]);

  function renderOfficialSpinoraPoster() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = 800;
    const height = 1200;
    canvas.width = width;
    canvas.height = height;

    // 1. Dark Cyberpunk Background Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, "#0e091b");
    bgGrad.addColorStop(0.5, "#06030c");
    bgGrad.addColorStop(1, "#000000");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. LARGE BACKGROUND SPINORA LOGO WATERMARK (Signature Brand Feature)
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.strokeStyle = preset.glowColor;
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(width / 2, height / 2 - 50, 220, 0, 2 * Math.PI);
    ctx.stroke();

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(width / 2, height / 2 - 50, 150, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.restore();

    // 3. Dual Neon Outer Border Frame (Cyan/Purple/Gold Glow)
    ctx.shadowColor = preset.glowColor;
    ctx.shadowBlur = 25;
    ctx.strokeStyle = preset.glowColor;
    ctx.lineWidth = 8;
    ctx.strokeRect(20, 20, width - 40, height - 40);

    ctx.shadowBlur = 10;
    ctx.strokeStyle = "#8b5cf6";
    ctx.lineWidth = 4;
    ctx.strokeRect(28, 28, width - 56, height - 56);

    ctx.shadowBlur = 0;

    // 4. Official Multi-Color Spinora Logo Emblem & Spiral at Top
    ctx.textAlign = "center";

    // Multi-color Spinora Spiral Icon
    const spiralGrad = ctx.createConicGradient(0, width / 2, 85);
    spiralGrad.addColorStop(0, "#ff0055");
    spiralGrad.addColorStop(0.33, "#8b5cf6");
    spiralGrad.addColorStop(0.66, "#00f0ff");
    spiralGrad.addColorStop(1, "#f59e0b");

    ctx.fillStyle = spiralGrad;
    ctx.beginPath();
    ctx.arc(width / 2, 85, 24, 0, 2 * Math.PI);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "black 44px Arial, sans-serif";
    ctx.fillText("Spinora", width / 2, 128);

    // Tagline: YOUR LUCK, YOUR WIN!
    ctx.fillStyle = preset.glowColor;
    ctx.font = "bold 15px Arial, sans-serif";
    ctx.fillText(`— ${preset.badgeSubtitle} —`, width / 2, 154);

    // Date Ribbon
    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    ctx.fillRect(width / 2 - 210, 172, 420, 32);
    ctx.strokeStyle = preset.glowColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(width / 2 - 210, 172, 420, 32);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 13px monospace";
    ctx.fillText(`🗓️ OFFICIAL OFFER • ${dateText.toUpperCase()}`, width / 2, 193);

    // 5. Giant 3D Gold Offer Text: GET $10 FREE PLAY
    ctx.shadowColor = "#f59e0b";
    ctx.shadowBlur = 35;

    // Gold 3D Text Effect
    ctx.fillStyle = "#f59e0b";
    ctx.font = "black 54px Arial, sans-serif";
    ctx.fillText(offerText, width / 2, 280);

    ctx.shadowBlur = 0;

    // 6. Game Character & Visual Graphic Section with Logo Watermark
    ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
    ctx.fillRect(60, 325, width - 120, 280);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.strokeRect(60, 325, width - 120, 280);

    if (preset.characterType === "dealer") {
      ctx.font = "100px Arial";
      ctx.fillText("🤵🃏🎲🎰", width / 2, 475);
    } else if (preset.characterType === "woman") {
      ctx.font = "100px Arial";
      ctx.fillText("💃💎💰🎰", width / 2, 475);
    } else if (preset.characterType === "slot777") {
      ctx.font = "100px Arial";
      ctx.fillText("🎰7️⃣7️⃣7️⃣💎", width / 2, 475);
    } else {
      ctx.font = "100px Arial";
      ctx.fillText("🎁✨💰🎲", width / 2, 475);
    }

    // 7. Spinora Bullet Points Box
    ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
    ctx.fillRect(80, 635, width - 160, 240);
    ctx.strokeStyle = preset.glowColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(80, 635, width - 160, 240);

    ctx.textAlign = "left";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 19px Arial, sans-serif";
    ctx.fillText("🎁 $3 FREE PLAY SIGN-UP BONUS", 110, 685);
    ctx.fillText("💎 EXCITING SLOTS & CASINO GAMES", 110, 735);
    ctx.fillText("⚡ FAST & EASY REGISTRATION", 110, 785);
    ctx.fillText("🏆 BIG WINS AWAIT YOU!", 110, 835);

    // 8. Neon CTA Pill Button: VISIT OUR WEBSITE NOW
    ctx.textAlign = "center";
    ctx.shadowColor = preset.glowColor;
    ctx.shadowBlur = 20;

    ctx.fillStyle = preset.glowColor;
    ctx.beginPath();
    ctx.roundRect(100, 930, width - 200, 60, [30]);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = "#000000";
    ctx.font = "black 22px Arial, sans-serif";
    ctx.fillText("🌐 VISIT OUR WEBSITE NOW", width / 2, 968);

    // White Pill Domain Name: spinoracasinos.com
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.roundRect(180, 1010, width - 360, 44, [22]);
    ctx.fill();

    ctx.fillStyle = "#000000";
    ctx.font = "bold 20px monospace";
    ctx.fillText(domainText, width / 2, 1039);

    // Footer Tagline
    ctx.fillStyle = "#f59e0b";
    ctx.font = "bold 15px Arial, sans-serif";
    ctx.fillText("SPIN • PLAY • WIN BIG 👑", width / 2, 1100);

    // Legal Footnote
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.font = "11px Arial, sans-serif";
    ctx.fillText("*T&CS APPLY. FOR ENTERTAINMENT PURPOSES FOR FREE CREDIT ELIGIBILITY", width / 2, 1130);
  }

  function handleDownloadPoster() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `spinora_brand_poster_${preset.id}_${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
    toast.success("Downloaded Official Spinora Brand Poster with Logo Background (PNG)!");
  }

  return (
    <GlassCard className="p-6 border-amber-500/30 bg-background/80">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border/50 pb-4 mb-6 gap-2">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-amber-400" />
            Official Spinora Brand Poster Generator (With Logo Background)
          </h2>
          <p className="text-xs text-muted-foreground">
            Generate 100% official Spinora promotional poster images with the signature background Spinora logo watermark and real-time dates.
          </p>
        </div>
        <Badge className="bg-amber-500/20 text-amber-400 font-mono shrink-0">LOGO BACKGROUND FORMAT</Badge>
      </div>

      {/* Official Poster Presets */}
      <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2.5 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5" /> Select Official Spinora Poster Format
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {SPINORA_POSTER_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPreset(p)}
              className={`rounded-xl border p-3 text-left transition-all ${
                preset.id === p.id
                  ? "bg-amber-500/20 border-amber-400 font-bold"
                  : "border-border/60 bg-background/80 hover:bg-amber-500/10"
              }`}
            >
              <span className="text-xs font-bold text-foreground block mb-1">{p.name}</span>
              <span className="text-[10px] text-amber-300 font-mono">Generate Format →</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Controls Column */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase text-foreground mb-1">
              3D Gold Offer Headline
            </label>
            <input
              type="text"
              value={offerText}
              onChange={(e) => setOfferText(e.target.value)}
              placeholder="e.g. GET $10 FREE PLAY"
              className="w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-foreground mb-1">
              Injected Date Header
            </label>
            <input
              type="text"
              value={dateText}
              onChange={(e) => setDateText(e.target.value)}
              className="w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-foreground mb-1">
              Website Domain Footer
            </label>
            <input
              type="text"
              value={domainText}
              onChange={(e) => setDomainText(e.target.value)}
              className="w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <Button
            onClick={handleDownloadPoster}
            className="w-full bg-amber-500 text-black hover:bg-amber-400 font-bold py-5 rounded-xl text-sm gap-2"
          >
            <Download className="h-4 w-4" /> Download Official Spinora Poster (PNG)
          </Button>
        </div>

        {/* Live Canvas Preview Column */}
        <div className="space-y-2 text-center">
          <label className="block text-xs font-bold uppercase text-foreground flex items-center justify-center gap-1.5 mb-2">
            <ImageIcon className="h-3.5 w-3.5 text-amber-400" /> Live Official Poster Format Preview
          </label>

          <div className="rounded-2xl border border-amber-500/30 bg-black p-3 inline-block shadow-2xl">
            <canvas
              ref={canvasRef}
              className="max-h-[480px] w-auto rounded-xl border border-white/10 object-contain shadow-lg"
            />
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
