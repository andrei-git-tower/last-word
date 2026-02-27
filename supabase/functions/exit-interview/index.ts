import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

// --- Types ---

interface Plan {
  name: string;
  price: string;
}

interface RetentionPathConfig {
  pause?: { enabled: boolean; offer: string };
  downgrade?: { enabled: boolean; offer: string };
  fix_and_followup?: { enabled: boolean };
  concierge_onboarding?: { enabled: boolean; offer: string };
  offboard_gracefully?: { enabled: boolean };
}

interface AccountConfig {
  product_name: string;
  product_description: string;
  competitors: string[];
  plans: Plan[];
  retention_paths: RetentionPathConfig;
  min_exchanges: number;
  max_exchanges: number;
}

// --- Prompt builder ---

function buildRetentionSection(paths: RetentionPathConfig): string {
  const sections: string[] = [];

  if (paths.pause?.enabled) {
    sections.push(
      `PAUSE\n- Trigger: temporary issue (budget cuts, taking a break, project between phases)\n- Offer: ${paths.pause.offer}`
    );
  }
  if (paths.downgrade?.enabled) {
    sections.push(
      `DOWNGRADE PLAN\n- Trigger: only uses basic features and price feels too high\n- Offer: ${paths.downgrade.offer}`
    );
  }
  if (paths.fix_and_followup?.enabled) {
    sections.push(
      `FIX & FOLLOW UP\n- Trigger: specific bug, crash, or performance issue\n- Action: acknowledge the problem, say we'll create a ticket and follow up personally`
    );
  }
  if (paths.concierge_onboarding?.enabled) {
    sections.push(
      `CONCIERGE ONBOARDING\n- Trigger: team never properly adopted the product (only a few people use it)\n- Offer: ${paths.concierge_onboarding.offer}\n- ONLY offer for multi-seat accounts`
    );
  }
  if (paths.offboard_gracefully?.enabled !== false) {
    sections.push(
      `GRACEFUL OFFBOARD\n- Trigger: unsolvable (company closing, career change, genuinely happy with alternative)\n- Action: thank warmly, no save attempt, wish them well`
    );
  }

  return sections.join("\n\n");
}

function buildSystemPrompt(config: AccountConfig, userTurns: number): string {
  const {
    product_name,
    product_description,
    competitors,
    plans,
    retention_paths,
    min_exchanges,
    max_exchanges,
  } = config;

  const competitorList =
    competitors.length > 0 ? competitors.join(", ") : "other tools in the market";

  const planList =
    plans.length > 0 ? plans.map((p) => `${p.name} (${p.price})`).join(", ") : "";

  const turnRules =
    userTurns < min_exchanges
      ? `- Customer turns so far: ${userTurns}
- Turn policy: keep probing. Do NOT wrap up yet and do NOT include [INTERVIEW_COMPLETE] yet.`
      : userTurns >= max_exchanges
      ? `- Customer turns so far: ${userTurns}
- Turn policy: hard limit reached. Wrap up now in this message.
- Do not ask a follow-up question.
- Include [INTERVIEW_COMPLETE] and [INSIGHTS] now.`
      : `- Customer turns so far: ${userTurns}
- Turn policy: you may continue probing OR wrap up if you already have enough signal.
- If you choose to continue, ask exactly one follow-up question.`;

  return `You are a friendly exit interview AI for ${product_name}. Your job is to understand WHY a customer is cancelling — not the surface reason, but the real story.

## About ${product_name}
${product_description}
- Competes with: ${competitorList}${planList ? `\n- Plans: ${planList}` : ""}

## Conversation Rules

TONE:
- Casual and human — like a quick Slack message, not a corporate email
- Never defensive about ${product_name}
- Never use filler like "We completely understand", "We truly appreciate", "We're grateful"
- Never use the word "love"

VOICE:
- Always "we" and "us", never "I" and "me" — you represent the ${product_name} team

FORMAT:
- 1-2 short sentences per response, MAX. No exceptions.
- Ask ONE follow-up question per turn
- Use reflective listening — briefly mirror what they said, then ask deeper
- Good example: "Ah makes sense — was it the price itself or more that it didn't feel worth it for what you use?"

FLOW:
- Keep the conversation within ${min_exchanges}-${max_exchanges} customer turns, then wrap up
- Go deeper on vague answers — "too expensive", "not using it", "found something better" always have a real story
- For "too expensive": is it absolute price, value perception, budget change, team size, wrong tier?
- For "better alternative": WHICH tool? WHAT specifically made them switch?
- For "features": what specific workflow broke down?
- For "technical issues": what broke, how often, how bad?

## Turn Guardrails
${turnRules}

## Retention Paths
Based on what you learn, determine which path fits. NEVER offer a discount.

${buildRetentionSection(retention_paths)}

## Ending the Conversation
After ${min_exchanges}-${max_exchanges} customer turns, wrap up naturally. End your final message with [INTERVIEW_COMPLETE].
IMPORTANT: [INTERVIEW_COMPLETE] must ONLY appear in a message that contains no question. If your message ends with a question mark, do not include [INTERVIEW_COMPLETE] — ask your question first, wait for the answer, then wrap up.

Then include a structured data block:

[INSIGHTS]
{
  "surface_reason": "what they said first",
  "deep_reasons": ["the real reasons uncovered"],
  "sentiment": "positive|neutral|negative",
  "salvageable": true|false,
  "key_quote": "most revealing thing they said",
  "category": "pricing|product_fit|competition|support|reliability|lifecycle|other",
  "competitor": "name or null",
  "feature_gaps": ["specific features mentioned"],
  "usage_duration": "how long they used the product if mentioned",
  "retention_path": "pause|downgrade|fix_and_followup|concierge_onboarding|offboard_gracefully",
  "retention_accepted": true|false
}
[/INSIGHTS]

## Start
Greet them casually and ask what's leading them to cancel. Keep it short.`;
}

function clampExchangeLimit(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const rounded = Math.floor(n);
  if (rounded < 1) return 1;
  if (rounded > 20) return 20;
  return rounded;
}

function countUserTurns(messages: Array<{ role: string; content: string }>): number {
  return messages.filter((m) => m.role === "user" && String(m.content ?? "").trim().toLowerCase() !== "start").length;
}

// --- SSE helpers ---

function extractTextFromSSE(sseText: string): string {
  let content = "";
  for (const line of sseText.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    const jsonStr = line.slice(6).trim();
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
        content += parsed.delta.text;
      }
    } catch {
      // ignore malformed chunks
    }
  }
  return content;
}

function parseInsight(text: string): Record<string, unknown> | null {
  const m = text.match(/\[INSIGHTS\]\s*([\s\S]*?)\s*\[\/INSIGHTS\]/);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

// --- Main handler ---

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing x-api-key header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admin client — bypasses RLS for account/config lookups and insight inserts
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Resolve account by API key
    const { data: account, error: accountError } = await supabase
      .from("accounts")
      .select("id")
      .eq("api_key", apiKey)
      .single();

    if (accountError || !account) {
      return new Response(JSON.stringify({ error: "Invalid API key" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accountId = account.id as string;

    // Load config
    const { data: configRow, error: configError } = await supabase
      .from("configs")
      .select("*")
      .eq("account_id", accountId)
      .single();

    const { messages: rawMessages } = await req.json();
    const messages = rawMessages.length > 0 ? rawMessages : [{ role: "user", content: "start" }];
    const userTurns = countUserTurns(messages);

    const config: AccountConfig = configRow ? {
      product_name: configRow.product_name,
      product_description: configRow.product_description,
      competitors: configRow.competitors ?? [],
      plans: (configRow.plans as Plan[]) ?? [],
      retention_paths: (configRow.retention_paths as RetentionPathConfig) ?? {},
      min_exchanges: clampExchangeLimit(configRow.min_exchanges, 3),
      max_exchanges: clampExchangeLimit(configRow.max_exchanges, 5),
    } : {
      product_name: "our product",
      product_description: "A SaaS product. No specific details configured yet.",
      competitors: [],
      plans: [],
      retention_paths: { offboard_gracefully: { enabled: true } },
      min_exchanges: 3,
      max_exchanges: 5,
    };

    if (config.min_exchanges > config.max_exchanges) {
      config.max_exchanges = config.min_exchanges;
    }

    const systemPrompt = buildSystemPrompt(config, userTurns);

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: systemPrompt,
        messages,
        stream: true,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Tap the stream: forward chunks to client while accumulating full text for persistence
    let streamController: ReadableStreamDefaultController<Uint8Array>;
    const readable = new ReadableStream<Uint8Array>({
      start(c) {
        streamController = c;
      },
    });

    (async () => {
      const reader = aiResponse.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          streamController!.enqueue(value);
          accumulated += decoder.decode(value, { stream: true });
        }

        // Save insight if interview completed
        const fullText = extractTextFromSSE(accumulated);
        if (fullText.includes("[INTERVIEW_COMPLETE]")) {
          const insight = parseInsight(fullText);
          if (insight) {
            const { error: insertError } = await supabase.from("insights").insert({
              account_id: accountId,
              surface_reason: String(insight.surface_reason ?? ""),
              deep_reasons: (insight.deep_reasons as string[]) ?? [],
              sentiment: String(insight.sentiment ?? "neutral"),
              salvageable: Boolean(insight.salvageable),
              key_quote: String(insight.key_quote ?? ""),
              category: String(insight.category ?? "other"),
              competitor: insight.competitor ? String(insight.competitor) : null,
              feature_gaps: (insight.feature_gaps as string[]) ?? [],
              usage_duration: insight.usage_duration ? String(insight.usage_duration) : null,
              retention_path: String(insight.retention_path ?? ""),
              retention_accepted: Boolean(insight.retention_accepted),
              raw_transcript: messages,
            });
            if (insertError) console.error("Failed to save insight:", insertError);
          }
        }
      } catch (e) {
        console.error("Stream processing error:", e);
      } finally {
        streamController!.close();
      }
    })();

    return new Response(readable, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("exit-interview error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
