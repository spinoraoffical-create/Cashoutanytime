import { createAdminClient } from "@/lib/supabase/admin";
import {
  getChatbotSettings,
  getBotSenderProfileId,
  personalityPrompt,
} from "@/lib/ai/settings";

export interface AIChatBotResponse {
  response: string;
  confidenceScore: number;
  shouldEscalateToHuman: boolean;
}

const PLATFORM_KNOWLEDGE = [
  {
    keywords: ["juwa", "juwa777", "juwa download", "juwa account"],
    answer:
      "🎮 <b>Juwa 777 Game Guide:</b>\nYou can request a Juwa account directly from your Spinora Dashboard under 'Game Requests'. Deposits are processed instantly via USDT, Chime, PayPal, or Cash App!",
    confidence: 0.95,
  },
  {
    keywords: ["fire kirin", "firekirin", "fish table"],
    answer:
      "🐟 <b>Fire Kirin Guide:</b>\nFire Kirin is one of our top-rated fish table platforms. To get your account setup or reload credits, visit the 'Deposit & Load' section on your dashboard.",
    confidence: 0.95,
  },
  {
    keywords: ["orion stars", "orionstars"],
    answer:
      "✨ <b>Orion Stars Guide:</b>\nOrion Stars features premium reel slots and sweepstakes games. Submit a request on Spinora and our automated bot will issue your credentials within minutes!",
    confidence: 0.95,
  },
  {
    keywords: ["deposit", "add money", "reload", "payment", "chime", "cashapp", "usdt", "paypal"],
    answer:
      "💳 <b>Deposit & Load Instructions:</b>\n1. Go to your Dashboard → Deposits.\n2. Select your payment method (USDT, Chime, Cash App, PayPal, Venmo, BTC).\n3. Submit your proof of payment.\n4. Credits will be loaded to your game account automatically!",
    confidence: 0.9,
  },
  {
    keywords: ["cashout", "withdraw", "payout", "redeem", "collect money"],
    answer:
      "💰 <b>Cashout & Redemption Guide:</b>\nCashout payouts are processed fast! Submit a cashout request from your Wallet page, specify your cashtag/wallet address, and our team will fulfill it within 5-15 minutes.",
    confidence: 0.9,
  },
  {
    keywords: ["vip", "tier", "level", "bronze", "silver", "gold", "platinum"],
    answer:
      "👑 <b>VIP Tier Program:</b>\nEarn points with every deposit! VIP members unlock higher deposit bonus multipliers, priority support, and exclusive daily wheel spin caps.",
    confidence: 0.9,
  },
  {
    keywords: ["spin", "wheel", "bonus", "free credits"],
    answer:
      "🎰 <b>Daily Wheel & Bonus Credits:</b>\nDon't forget to visit the Daily Spin Wheel at /spin every 24 hours to claim instant bonus credits added directly to your wallet!",
    confidence: 0.9,
  },
  {
    keywords: ["agent", "human", "support", "help", "admin", "ticket"],
    answer:
      "🙋 <b>Connecting with Support:</b>\nI am escalating your conversation to a live Spinora Customer Support agent right now. A member of our team will reply here shortly!",
    confidence: 0.5,
  },
];

function stripHtmlForDisplay(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export async function processAIChatQuery(
  userQuery: string,
  conversationId?: string,
  userId?: string
): Promise<AIChatBotResponse> {
  const settings = await getChatbotSettings();

  if (!settings.is_enabled) {
    return {
      response: "Live chat support is temporarily unavailable. Please try again shortly or email support.",
      confidenceScore: 0,
      shouldEscalateToHuman: true,
    };
  }

  const queryLower = userQuery.toLowerCase().trim();
  const threshold = Number(settings.human_handover_threshold) || 0.6;

  let bestMatch: { answer: string; confidence: number } | null = null;
  for (const item of PLATFORM_KNOWLEDGE) {
    if (item.keywords.some((kw) => queryLower.includes(kw))) {
      if (!bestMatch || item.confidence > bestMatch.confidence) {
        bestMatch = { answer: item.answer, confidence: item.confidence };
      }
    }
  }

  const openRouterKey = process.env.OPENROUTER_API_KEY?.trim();
  const openAiKey = process.env.OPENAI_API_KEY?.trim();
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  const apiKey = openRouterKey || openAiKey || geminiKey;

  let botResponse = bestMatch?.answer || "";
  let confidenceScore = bestMatch?.confidence || 0.6;
  let shouldEscalateToHuman =
    confidenceScore < threshold ||
    queryLower.includes("agent") ||
    queryLower.includes("human") ||
    queryLower.includes("manager");

  if (apiKey && settings.auto_reply_enabled && (userId || !bestMatch || bestMatch.confidence < 0.92)) {
    try {
      let playerContextText = "";
      if (userId) {
        const db = createAdminClient();
        if (db) {
          try {
            const [profRes, vipRes, accsRes, loadsRes] = await Promise.all([
              db.from("profiles").select("display_name, username, wallet_balance, cashout_wallet, level, coins_balance").eq("id", userId).maybeSingle(),
              db.from("vip_status").select("vip_tiers(name)").eq("user_id", userId).maybeSingle(),
              db.from("game_accounts").select("game_username, credits_balance, games(name)").eq("user_id", userId),
              db.from("game_load_requests").select("game_name, amount, load_type, status, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(3),
            ]);

            if (profRes.data) {
              const p = profRes.data;
              const vipTier = (vipRes.data?.vip_tiers as any)?.name ?? "Bronze";
              playerContextText += `
[CRITICAL REAL-TIME PLAYER ACCOUNT CONTEXT]
- Display Name: ${p.display_name || p.username || "Player"}
- VIP Level: ${vipTier} (Lv. ${p.level || 1})
- Coins Balance: ${p.coins_balance || 0}
- Current Deposit Wallet Balance: $${(p.wallet_balance || 0).toFixed(2)}
- Current Cashout/Withdrawal Wallet Balance: $${(p.cashout_wallet || 0).toFixed(2)}
`;
            }

            if (accsRes.data && accsRes.data.length > 0) {
              playerContextText += "\nPlayer Game Accounts:\n";
              for (const acc of accsRes.data) {
                const gName = (acc.games as any)?.name ?? "Unknown Game";
                playerContextText += `- ${gName}: Username: @${acc.game_username}, Balance: $${(acc.credits_balance || 0).toFixed(2)}\n`;
              }
            } else if (accsRes.data) {
              playerContextText += "\nPlayer Game Accounts: None registered yet.\n";
            }

            if (loadsRes.data && loadsRes.data.length > 0) {
              playerContextText += "\nRecent Player Requests (Deposits/Redeems/Accounts):\n";
              for (const r of loadsRes.data) {
                const dateStr = new Date(r.created_at).toLocaleDateString();
                playerContextText += `- [${dateStr}] ${r.load_type.toUpperCase()} request for ${r.game_name} ($${(r.amount || 0).toFixed(2)}) is: ${r.status.toUpperCase()}\n`;
              }
            }
          } catch (err) {
            console.error("[AIChatBot] Failed to load user context:", err);
          }
        }
      }

      const systemContent = `${settings.system_prompt}\n${personalityPrompt(settings.personality)}${playerContextText ? `\n\n${playerContextText}` : ""}\n\nImportant Instructions: Use the real-time context above if available to answer account-specific questions (like checking balance, usernames, or recent deposits). Keep the tone matched to the personality rules.`;

      if (geminiKey && !openRouterKey && !openAiKey) {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: `${systemContent}\n\nUser: ${userQuery}` }] }],
            }),
          }
        );
        if (res.ok) {
          const data = await res.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            botResponse = text;
            confidenceScore = 0.88;
            shouldEscalateToHuman = false;
          }
        }
      } else {
        const endpoint = openRouterKey
          ? "https://openrouter.ai/api/v1/chat/completions"
          : "https://api.openai.com/v1/chat/completions";

        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: openRouterKey ? "openai/gpt-4o-mini" : "gpt-4o-mini",
            messages: [
              { role: "system", content: systemContent },
              { role: "user", content: userQuery },
            ],
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const text = data.choices?.[0]?.message?.content;
          if (text) {
            botResponse = text;
            confidenceScore = 0.88;
            shouldEscalateToHuman = false;
          }
        }
      }
    } catch (error) {
      console.error("[AIChatBot] LLM error:", error);
    }
  }

  if (!botResponse) {
    botResponse = `Hello! I am ${settings.bot_name}. I can help with Game Requests, Deposits, Cashouts, and VIP Rewards. Reply with "agent" to reach a human.`;
    confidenceScore = 0.7;
  }

  shouldEscalateToHuman =
    shouldEscalateToHuman ||
    confidenceScore < threshold ||
    queryLower.includes("agent") ||
    queryLower.includes("human");

  const db = createAdminClient();
  if (db) {
    try {
      await db.from("ai_chat_logs").insert({
        conversation_id: conversationId || null,
        user_id: userId || null,
        user_query: userQuery.slice(0, 2000),
        bot_response: botResponse.slice(0, 4000),
        confidence_score: confidenceScore,
        escalated_to_human: shouldEscalateToHuman,
      });
    } catch (logErr) {
      console.error("[AIChatBot] Log error:", logErr);
    }
  }

  return {
    response: botResponse,
    confidenceScore,
    shouldEscalateToHuman,
  };
}

export { getBotSenderProfileId, stripHtmlForDisplay };
