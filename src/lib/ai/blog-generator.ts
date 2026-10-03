import { createAdminClient } from "@/lib/supabase/admin";
import { resolveBlogCoverUrl } from "@/lib/blog-cover";
import { getBlogSettings, updateBlogSettings } from "@/lib/ai/settings";

export interface GeneratedBlogPost {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  seo_title: string;
  seo_description: string;
  seo_keywords: string[];
  cover_image: string;
  visual_prompt?: string;
  reading_time_minutes: number;
  category: string;
  tags: string[];
}

export interface BlogGeneratorOptions {
  topic?: string;
  targetKeywords?: string[];
  customPrompt?: string;
  aiProvider?: "smart_auto" | "openai" | "openrouter" | "gemini";
  aiModel?: string;
}

/** 10,000+ Topic Matrix Generators */
const GAME_PLATFORMS = [
  "Juwa 777",
  "Orion Stars",
  "Fire Kirin",
  "Game Vault 999",
  "Panda Master",
  "Vegas Sweeps",
  "Cash Machine",
  "Mafia 777",
  "Cash Frenzy",
  "Milky Way",
  "Spinora Slots",
];

const TOPIC_ANGLES = [
  "Ultimate 2026 Strategy Guide & Free Credit Tricks",
  "How to Unlock VIP Rewards & Instant 5-Minute Cashouts",
  "Highest RTP Slot Games & Secret Payout Patterns",
  "Fish Table Boss Tactics & High-Caliber Ammo Reload Guide",
  "Deposit Bonus Match & Daily Wheel Spin Walkthrough",
  "How to Play Like a Pro & Maximize Session Longevity",
  "Beginner to Master Guide: Everything You Need to Know",
  "Exclusive Promo Codes & Wallet Reload Walkthrough",
];

const GAMING_KEYWORDS = [
  "spinora bonus code",
  "juwa 777 download",
  "orion stars free credits",
  "fire kirin deposit bonus",
  "game vault instant cashout",
  "fish table game cheats",
  "play online slots real money",
  "spinora gaming support",
  "cash machine reload guide",
  "panda master jackpot tips",
  "vegas sweeps bonus code",
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateDynamicTopic(existingTitles: string[] = []): string {
  for (let i = 0; i < 100; i++) {
    const game = getRandomItem(GAME_PLATFORMS);
    const angle = getRandomItem(TOPIC_ANGLES);
    const candidate = `${game}: ${angle}`;
    
    const isDuplicate = existingTitles.some((title) => {
      const tLower = title.toLowerCase();
      const gLower = game.toLowerCase();
      return tLower.includes(gLower) && (tLower.includes(candidate.toLowerCase()) || tLower.includes(angle.slice(0, 15).toLowerCase()));
    });
    
    if (!isDuplicate) return candidate;
  }
  
  const game = getRandomItem(GAME_PLATFORMS);
  const angle = getRandomItem(TOPIC_ANGLES);
  return `${game}: ${angle}`;
}

async function generateUniqueTopicViaLLM(
  existingTitles: string[],
  settingsTopics: string[],
  apiKey: string,
  provider: string,
  model?: string
): Promise<string> {
  const existingList = existingTitles.slice(0, 25).map((t) => `- "${t}"`).join("\n");
  const settingsList = settingsTopics.slice(0, 10).map((t) => `- "${t}"`).join("\n");
  
  const systemPrompt = "You are an expert SEO strategist and copywriter. Generate a single highly specific, high-intent, unique blog post topic.";
  const userPrompt = `
Generate a single unique, high-converting SEO blog post topic targeting sweepstakes casino players in the USA.
We focus on platforms like Juwa, Orion Stars, Game Vault, Fire Kirin, Panda Master, Milky Way, Vegas Sweeps, Cash Machine, and Spinora.

CRITICAL: Do NOT repeat the exact topic, title, or core angle of any of these existing articles:
${existingList || "None"}

${settingsList ? `Try to align with these general themes if possible:\n${settingsList}` : ""}

Output ONLY the topic line as plain text. No quotation marks, no markdown, no punctuation. E.g.: "Juwa 777: 5 Hidden Features for High Roller Players"
`;

  try {
    if (provider === "gemini") {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
            generationConfig: {
              temperature: 0.85,
            }
          }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text) return text.replace(/^["']|["']$/g, "");
      }
    } else {
      const openRouterKey = process.env.OPENROUTER_API_KEY?.trim();
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
          model: model || (openRouterKey ? "openai/gpt-4o-mini" : "gpt-4o-mini"),
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.85,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content?.trim();
        if (text) return text.replace(/^["']|["']$/g, "");
      }
    }
  } catch (err) {
    console.error("[BlogGenerator] Failed to generate unique topic via LLM:", err);
  }

  return generateDynamicTopic(existingTitles);
}

/**
 * SKILL RULE: auto-blog-image-fix (Visual Prompt Reconstruction Engine)
 * Translates abstract platform names into physical 3D scene descriptions
 * guaranteeing NO text, logos, or gibberish typography in generated graphics.
 */
export function constructTextFreeVisualPrompt(title: string): string {
  const s = title.toLowerCase();

  if (s.includes("juwa") || s.includes("slot") || s.includes("777") || s.includes("vegas") || s.includes("frenzy")) {
    return "A vibrant 3D render of a luxury casino slot machine reel showcasing glowing triple 777 symbols, falling gold coins exploding outward, cinematic dramatic studio lighting, deep neon purple and gold accents, clean text-free composition, high-resolution 3D art.";
  }

  if (s.includes("fire kirin") || s.includes("fish") || s.includes("panda") || s.includes("milky way")) {
    return "A 3D photorealistic underwater fish table game scene featuring a golden dragon fish swimming through vibrant coral reefs, glowing treasure chest overflowing with gold coins and blue crystals, dramatic lighting, text-free clear background.";
  }

  if (s.includes("orion") || s.includes("star") || s.includes("cosmic")) {
    return "A cosmic 3D celestial slot game scene with glowing stars, golden coins orbiting in space, deep indigo nebula background, cinematic lighting, text-free.";
  }

  if (s.includes("deposit") || s.includes("cashapp") || s.includes("zelle") || s.includes("crypto") || s.includes("vault")) {
    return "A 3D luxury vault door opening to reveal piles of golden coins, sparkling diamonds, glowing casino chips, cinematic studio lighting, dark neon gold background, text-free.";
  }

  return "A high-resolution 3D casino gaming scene with glowing dice, stacks of colorful poker chips, gold coins, neon lighting, clean text-free composition.";
}

/** 100% Content-to-Photo Smart Matcher for AI Blog Generation */
function getDynamicCoverImage(title: string): string {
  const slug = slugify(title);
  return resolveBlogCoverUrl(slug, null);
}

/** Fallback generator producing rich HTML content with dynamic matrices & structured schemas */
function generateFallbackArticle(
  topicTitle: string,
  keywords: string[]
): GeneratedBlogPost {
  const slug = `${slugify(topicTitle)}-${Date.now().toString().slice(-4)}`;
  const mainKeyword = keywords[0] || "online gaming bonus";
  const secondaryKeywords = keywords.slice(1);
  const coverImage = getDynamicCoverImage(topicTitle);
  const visualPrompt = constructTextFreeVisualPrompt(topicTitle);

  const introVariants = [
    `Welcome to the definitive guide on <strong>${topicTitle}</strong>. Whether you are looking to elevate your gameplay, unlock exclusive <strong>${mainKeyword}</strong> perks, or secure faster cashouts, this guide covers everything you need to know to stay ahead on the <strong>Spinora</strong> platform.`,
    `Are you ready to level up your gaming experience on <strong>${topicTitle}</strong>? In this expert walkthrough, we break down top-tier payout tactics, <strong>${mainKeyword}</strong> bonus strategies, and fast 15-minute cashout routines.`,
    `Mastering <strong>${topicTitle}</strong> requires more than luck—it takes strategic bankroll management, active <strong>${mainKeyword}</strong> promotions, and priority target selection on Spinora's 24/7 gaming platform.`,
  ];

  const section1Variants = [
    {
      heading: "1. Understanding Core Game Mechanics & Payout Patterns",
      body: `When playing top titles like <em>Juwa 777</em>, <em>Orion Stars</em>, <em>Fire Kirin</em>, and <em>Game Vault</em>, success relies on understanding payout multipliers and volatility patterns. Utilizing <strong>${mainKeyword}</strong> strategies gives players a distinct edge over random guessing. Fish table games require target prioritization—always focus on medium-tier boss fish when high-level weapons are active. For slot games, pay attention to Return To Player (RTP) percentages and trigger bonus rounds efficiently.`
    },
    {
      heading: "1. Mastering Game Volatility and Reel Rotation Cycles",
      body: `To consistently lock in wins across Spinora's 8 major platforms, players must study reel rotation speeds and volatility adjustments. By matching your play sessions with <strong>${mainKeyword}</strong> cycles, you can optimize coin conservation. Remember to adjust weapon firepower levels depending on target sizes to prevent early depletion of credits.`
    },
    {
      heading: "1. VIP Slot Mechanics and Strategic Account Loads",
      body: `High-RTP slots like Cash Machine and Vegas Sweeps feature distinct bonus match trigger windows. Smart players take advantage of Spinora's <strong>${mainKeyword}</strong> to increase their initial balance before spinning. Always keep an eye on active multiplier payouts to know when to shift platforms.`
    }
  ];

  const section2Variants = [
    {
      heading: "2. Step-by-Step Strategy for Maximum Cashouts",
      steps: `
    <strong class="text-emerald-400">Step 1: Request Dedicated Credentials</strong>
    <p class="text-sm text-muted-foreground ml-6 mb-2">Generate your safe credentials instantly on your Spinora dashboard under 'Game Requests'.</p>
    
    <strong class="text-emerald-400">Step 2: Load Your Wallet & Lock Bonuses</strong>
    <p class="text-sm text-muted-foreground ml-6 mb-2">Utilize fast payment options (Cash App, Venmo, USDT, PayPal) to load credits with matching multipliers.</p>

    <strong class="text-emerald-400">Step 3: Play & Cash Out Disciplined</strong>
    <p class="text-sm text-muted-foreground ml-6">Whenever hitting a major multiplier, submit a payout request for swift 15-minute processing.</p>`
    },
    {
      heading: "2. The 3-Rule Protocol for Smart Sweepstakes Play",
      steps: `
    <strong class="text-emerald-400">Rule 1: Never Miss Your Daily Spin</strong>
    <p class="text-sm text-muted-foreground ml-6 mb-2">Log in every 24 hours to spin the Spinora Wheel, yielding free wallet coins and XP points.</p>
    
    <strong class="text-emerald-400">Rule 2: Balance Volatility Across Platforms</strong>
    <p class="text-sm text-muted-foreground ml-6 mb-2">Rotate between slot platforms and fish shooters to balance your risk metrics.</p>

    <strong class="text-emerald-400">Rule 3: Set Firm Profit Targets</strong>
    <p class="text-sm text-muted-foreground ml-6">Cash out immediately when reaching double your deposit value to maintain long-term profitability.</p>`
    },
    {
      heading: "2. Automated Registration and Payout Optimization Guide",
      steps: `
    <strong class="text-emerald-400">Step 1: Download Official Mobile Clients</strong>
    <p class="text-sm text-muted-foreground ml-6 mb-2">Ensure you download verified apps via our platform's direct download links.</p>
    
    <strong class="text-emerald-400">Step 2: Elevate Your VIP Perks Tier</strong>
    <p class="text-sm text-muted-foreground ml-6 mb-2">Accumulate XP through wallet reloads to unlock Platinum level benefits and custom agent support.</p>

    <strong class="text-emerald-400">Step 3: Leverage 24/7 Fast Payouts</strong>
    <p class="text-sm text-muted-foreground ml-6">Submit withdrawal requests through our secure cashier system for 5-minute automated processing.</p>`
    }
  ];

  const section3Variants = [
    `Spinora is the leading sweepstakes gaming companion, offering 24/7 automated game account provisioning, real-time live chat assistance, instant deposit request handling, and tiered VIP cashback programs. ${secondaryKeywords.length > 0 ? `Targeted searches such as <em>${secondaryKeywords.join(", ")}</em> consistently lead players to Spinora for verified gaming services.` : ""}`,
    `By combining robust security layers with fast payment execution, Spinora delivers a premium playground for slot and fish table fans. ${secondaryKeywords.length > 0 ? `For search terms like <em>${secondaryKeywords.join(", ")}</em>, Spinora remains the highest-rated portal nationwide.` : ""}`,
    `With thousands of active players every single day, Spinora continues to lead the industry in automated loads and payout speeds. ${secondaryKeywords.length > 0 ? `Whether seeking information on <em>${secondaryKeywords.join(", ")}</em> or specific platform tips, Spinora is your complete casino portal.` : ""}`
  ];

  const faqVariants = [
    {
      q1: "How do I claim bonus credits on Spinora?",
      a1: "Navigate to your Spinora Dashboard, complete daily tasks, or spin the Bonus Wheel to instantly credit bonus funds to your wallet.",
      q2: "How fast are cashout payouts processed?",
      a2: "Most cashout requests are processed within 5 to 15 minutes by our dedicated support agents via Cash App, USDT, and Zelle."
    },
    {
      q1: "Can I play on multiple game platforms simultaneously?",
      a1: "Yes, you can register and play on Juwa, Orion Stars, Game Vault, and 5 other platforms using a single Spinora wallet.",
      q2: "What is the minimum deposit load?",
      a2: "The minimum load request is just $5.00, which qualifies you for matching first-time or daily reload VIP bonuses."
    },
    {
      q1: "How do I get my game login credentials?",
      a1: "After submitting an account request on the dashboard, our bot issues your unique login ID and password in under 2 minutes.",
      q2: "Is there a daily limit on spins?",
      a2: "You get one free Fortune Wheel spin every 24 hours, with prizes scaled up to $50.00 depending on your VIP rank tier."
    }
  ];

  const selSec1 = getRandomItem(section1Variants);
  const selSec2 = getRandomItem(section2Variants);
  const selSec3 = getRandomItem(section3Variants);
  const selFaq = getRandomItem(faqVariants);

  const content = `
<div class="blog-post-content space-y-6">
  <p class="text-lg leading-relaxed font-medium">
    ${getRandomItem(introVariants)}
  </p>

  <div class="my-6 p-4 border-l-4 border-emerald-500 bg-emerald-500/10 rounded-r-lg">
    <h3 class="text-md font-bold text-emerald-400 uppercase tracking-wider mb-1">⚡ Key Takeaways</h3>
    <ul class="list-disc list-inside space-y-1 text-sm text-foreground/90">
      <li>Always claim daily wheel spins and check active <strong>Spinora promotions</strong> before playing.</li>
      <li>Optimize your bet sizes according to your wallet balance for maximum session longevity.</li>
      <li>Use verified payment channels (USDT, Chime, PayPal, Cash App) for lightning-fast deposit requests.</li>
      <li>Escalate any account issues directly through Spinora Live Support for 24/7 assistance.</li>
    </ul>
  </div>

  <h2>${selSec1.heading}</h2>
  <p>${selSec1.body}</p>

  <h2>${selSec2.heading}</h2>
  <ol class="list-decimal list-inside space-y-2 pl-2">
    ${selSec2.steps}
  </ol>

  <h2>3. Why Spinora is the #1 Gaming Support Platform</h2>
  <p>${selSec3}</p>

  <h2>Frequently Asked Questions (FAQ)</h2>
  <div class="space-y-4">
    <div class="border border-border/60 rounded-lg p-4 bg-background/50">
      <h4 class="font-bold text-foreground">Q: ${selFaq.q1}</h4>
      <p class="text-sm text-muted-foreground mt-1">${selFaq.a1}</p>
    </div>
    <div class="border border-border/60 rounded-lg p-4 bg-background/50">
      <h4 class="font-bold text-foreground">Q: ${selFaq.q2}</h4>
      <p class="text-sm text-muted-foreground mt-1">${selFaq.a2}</p>
    </div>
  </div>

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "${selFaq.q1}",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "${selFaq.a1.replace(/"/g, '\\"')}"
        }
      },
      {
        "@type": "Question",
        "name": "${selFaq.q2}",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "${selFaq.a2.replace(/"/g, '\\"')}"
        }
      }
    ]
  }
  </script>
</div>
  `.trim();

  return {
    title: topicTitle,
    slug,
    excerpt: `Discover essential strategies and expert tips for ${topicTitle}. Learn how to master payouts and claim exclusive bonus credits on Spinora.`,
    content,
    seo_title: `${topicTitle} | Spinora Gaming Guide`,
    seo_description: `Learn how to master ${topicTitle} on Spinora. Read top tips, strategy guides, bonus credit walkthroughs, and fast cashout methods.`,
    seo_keywords: [mainKeyword, ...secondaryKeywords, "spinora", "online gaming", "casino bonus"],
    cover_image: coverImage,
    visual_prompt: visualPrompt,
    reading_time_minutes: 4,
    category: "Gaming Guides",
    tags: ["Strategy", "Bonuses", "Spinora", "Guide"],
  };
}

/** External LLM Caller (OpenRouter / OpenAI / Gemini) */
async function generateViaLLM(
  prompt: string,
  provider: string,
  model?: string
): Promise<GeneratedBlogPost | null> {
  const openRouterKey = process.env.OPENROUTER_API_KEY?.trim();
  const openAiKey = process.env.OPENAI_API_KEY?.trim();
  const geminiKey = process.env.GEMINI_API_KEY?.trim();

  const useGemini = provider === "gemini" && geminiKey;
  const apiKey = useGemini ? geminiKey : openRouterKey || openAiKey || geminiKey;

  if (!apiKey) return null;

  try {
    if (useGemini) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `You are an expert SEO gaming writer for Spinora. Output ONLY valid JSON with keys: title, slug, excerpt, content (HTML), seo_title, seo_description, seo_keywords (array), category, tags (array).\n\n${prompt}`,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.85,
            }
          }),
        }
      );
      if (!res.ok) return null;
      const data = await res.json();
      const jsonStr = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!jsonStr) return null;
      const parsed = JSON.parse(jsonStr.replace(/```json|```/g, "").trim()) as Partial<GeneratedBlogPost>;
      if (!parsed.title || !parsed.content) return null;
      return {
        title: parsed.title,
        slug: parsed.slug || slugify(parsed.title),
        excerpt: parsed.excerpt || parsed.title,
        content: parsed.content,
        seo_title: parsed.seo_title || `${parsed.title} | Spinora`,
        seo_description: parsed.seo_description || parsed.excerpt || parsed.title,
        seo_keywords: Array.isArray(parsed.seo_keywords) ? parsed.seo_keywords : ["spinora"],
        cover_image: getDynamicCoverImage(parsed.title),
        visual_prompt: constructTextFreeVisualPrompt(parsed.title),
        reading_time_minutes: Math.ceil(parsed.content.split(/\s+/).length / 200) || 4,
        category: parsed.category || "Gaming Guides",
        tags: Array.isArray(parsed.tags) ? parsed.tags : ["Gaming"],
      };
    }

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
        model: model || (openRouterKey ? "openai/gpt-4o-mini" : "gpt-4o-mini"),
        messages: [
          {
            role: "system",
            content: `You are an expert SEO content strategist and gaming writer for Spinora. Output ONLY a valid JSON object with: title, slug, excerpt, content (HTML with <h2>, <h3>, <ul>, <p>, <strong>), seo_title, seo_description, seo_keywords (array), category, tags (array).`,
          },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.85,
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const jsonStr = data.choices?.[0]?.message?.content;
    if (!jsonStr) return null;

    const parsed = JSON.parse(jsonStr) as Partial<GeneratedBlogPost>;
    if (!parsed.title || !parsed.content) return null;

    return {
      title: parsed.title,
      slug: parsed.slug || slugify(parsed.title),
      excerpt: parsed.excerpt || parsed.title,
      content: parsed.content,
      seo_title: parsed.seo_title || `${parsed.title} | Spinora`,
      seo_description: parsed.seo_description || parsed.excerpt || parsed.title,
      seo_keywords: Array.isArray(parsed.seo_keywords) ? parsed.seo_keywords : ["spinora"],
      cover_image: getDynamicCoverImage(parsed.title),
      visual_prompt: constructTextFreeVisualPrompt(parsed.title),
      reading_time_minutes: Math.ceil(parsed.content.split(/\s+/).length / 200) || 4,
      category: parsed.category || "Gaming Guides",
      tags: Array.isArray(parsed.tags) ? parsed.tags : ["Gaming"],
    };
  } catch (error) {
    console.error("[BlogGenerator] LLM Generation error:", error);
    return null;
  }
}

export const DYNAMIC_AI_POSTS = new Map<string, GeneratedBlogPost>();

/** Main Entry point to generate and persist a new AI SEO Blog Post */
export async function generateAndSaveAIBlogPost(
  options: BlogGeneratorOptions = {}
): Promise<{ ok: boolean; post?: GeneratedBlogPost; postId?: string; error?: string }> {
  const settings = await getBlogSettings();
  if (!settings.is_enabled && !options.topic) {
    return { ok: false, error: "AI blog automation is disabled in settings." };
  }

  // Fetch existing blog post titles to prevent duplicate/repeated topics
  const db = createAdminClient();
  let existingTitles: string[] = [];
  if (db) {
    try {
      const { data } = await db
        .from("blog_posts")
        .select("title")
        .order("created_at", { ascending: false })
        .limit(35);
      if (data) {
        existingTitles = data.map((d) => d.title);
      }
    } catch (e) {
      console.error("[BlogGenerator] Failed to load existing titles:", e);
    }
  }

  const provider = options.aiProvider ?? settings.ai_provider ?? "smart_auto";
  const model = options.aiModel ?? settings.ai_model;

  const openRouterKey = process.env.OPENROUTER_API_KEY?.trim();
  const openAiKey = process.env.OPENAI_API_KEY?.trim();
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  const apiKey = provider === "gemini" ? geminiKey : openRouterKey || openAiKey || geminiKey;

  const topic =
    options.topic ||
    (apiKey
      ? await generateUniqueTopicViaLLM(
          existingTitles,
          settings.topics.length ? settings.topics : [],
          apiKey,
          provider === "smart_auto" ? (openRouterKey ? "openrouter" : openAiKey ? "openai" : "gemini") : provider,
          model
        )
      : generateDynamicTopic(existingTitles));

  const keywords = options.targetKeywords?.length
    ? options.targetKeywords
    : settings.target_keywords.length
      ? settings.target_keywords
      : [getRandomItem(GAMING_KEYWORDS), "spinora gaming", "cashout guide"];

  const prompt = `
Write a comprehensive, highly engaging, and conversion-optimized SEO blog post on the topic: "${topic}".

Target Keywords (integrate these naturally throughout the headings, body, and conclusion):
${keywords.map((k) => `- ${k}`).join("\n")}

Strict Content Requirements:
1. Length: Ensure the article is extremely detailed and informative, at least 800 to 1200 words of rich content. Do not output thin content.
2. Headings: Use a clean heading hierarchy with <h2> and <h3> tags. Ensure the target keywords are naturally integrated into some of these headings.
3. Formatting: Use <strong> tags to highlight important terms, keywords, and player benefits.
4. Internal Conversion Links (CRITICAL): You MUST naturally weave 2 to 3 HTML links using the following exact URLs to convert readers into players:
   - For new player registration: <a href="/register">Sign up for a free Spinora account</a> (or similar conversion call-to-action).
   - For daily wheel spins: <a href="/spin">Spin our daily fortune wheel</a>.
   - For bonuses: <a href="/promotions">View active deposit bonuses</a>.
   - For game downloads: <a href="/games">Browse game platforms</a> (or mention specific platforms like <a href="/games/orion-stars">play Orion Stars</a>, <a href="/games/juwa">Juwa download</a>, or <a href="/games/game-vault">Game Vault login</a>).
5. Structure:
   - A catchy intro with a hook.
   - A key takeaways summary box using a styled div block (with bullet points).
   - Solid body paragraphs explaining tips, strategies, and mechanics.
   - A concluding FAQ section featuring 3 relevant player questions and detailed answers.
6. FAQ JSON-LD Schema (CRITICAL): Generate a valid JSON-LD FAQPage schema inside a <script type="application/ld+json"> tag at the very end of the content body matching the FAQ questions/answers.
7. Tone: Exciting, casino host, authoritative yet fun.

Custom Instructions (if any):
${options.customPrompt || "None"}
`.trim();

  let post: GeneratedBlogPost | null = null;

  if (provider === "smart_auto") {
    if (process.env.OPENROUTER_API_KEY?.trim()) {
      post = await generateViaLLM(prompt, "openrouter", model);
    }
    if (!post && process.env.OPENAI_API_KEY?.trim()) {
      post = await generateViaLLM(prompt, "openai", model);
    }
    if (!post && process.env.GEMINI_API_KEY?.trim()) {
      post = await generateViaLLM(prompt, "gemini", model);
    }
  } else {
    post = await generateViaLLM(prompt, provider, model);
  }

  if (!post) {
    post = generateFallbackArticle(topic, keywords);
  }

  // Ensure cover image 100% matches article content and follows auto-blog-image-fix rule
  post.cover_image = getDynamicCoverImage(post.title);
  post.visual_prompt = constructTextFreeVisualPrompt(post.title);

  // Cache in-memory for instant 0ms routing
  DYNAMIC_AI_POSTS.set(post.slug, post);

  if (!db) {
    return { ok: false, error: "Database client unavailable" };
  }

  const status = settings.auto_publish ? "published" : "draft";

  const { data, error } = await db
    .from("blog_posts")
    .insert({
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      content: post.content,
      cover_image_url: post.cover_image,
      seo_title: post.seo_title,
      seo_description: post.seo_description,
      tags: post.tags,
      status,
      published_at: status === "published" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (error) {
    if (error.message.includes("duplicate") || error.message.includes("unique")) {
      const uniqueSlug = `${post.slug}-${Date.now()}`;
      post.slug = uniqueSlug;
      DYNAMIC_AI_POSTS.set(uniqueSlug, post);

      const { data: retryData, error: retryErr } = await db
        .from("blog_posts")
        .insert({
          title: post.title,
          slug: uniqueSlug,
          excerpt: post.excerpt,
          content: post.content,
          cover_image_url: post.cover_image,
          seo_title: post.seo_title,
          seo_description: post.seo_description,
          tags: post.tags,
          status,
          published_at: status === "published" ? new Date().toISOString() : null,
        })
        .select("id")
        .single();

      if (retryErr) {
        return { ok: false, error: retryErr.message };
      }

      await updateBlogSettings({ last_generated_at: new Date().toISOString() });
      return { ok: true, post, postId: retryData.id };
    }
    return { ok: false, error: error.message };
  }

  await updateBlogSettings({ last_generated_at: new Date().toISOString() });
  return { ok: true, post, postId: data.id };
}

/** Bulk Generator: Publish 100+ AI Blog Posts per day with 100% matched Spinora poster photos */
export async function generateBatchAIBlogPosts(count = 10): Promise<{ count: number; posts: GeneratedBlogPost[] }> {
  const generated: GeneratedBlogPost[] = [];

  for (let i = 0; i < count; i++) {
    const res = await generateAndSaveAIBlogPost();
    if (res.post) {
      generated.push(res.post);
    }
  }

  return { count: generated.length, posts: generated };
}
