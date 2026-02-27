import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { geminiNonStreaming } from "../_shared/gemini.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Expose-Headers": "x-insight-id",
};

// --- Types ---

interface UserContext {
  email?: string;
  plan?: string;
  account_age?: number;  // days
  seats?: number;
  mrr?: number;
}

interface RuleCondition {
  variable: "plan" | "account_age" | "seats" | "mrr" | "email";
  operator: "==" | "!=" | ">" | "<" | ">=" | "<=" | "contains";
  value: string | number;
}

interface Rule {
  id: string;
  priority: number;
  condition_logic: "AND" | "OR";
  conditions: RuleCondition[];
  prompt_addition: string;
}

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
  brand_prompt: string;
}

interface InsightPayload {
  surface_reason: string;
  deep_reasons: string[];
  sentiment: string;
  salvageable: boolean;
  key_quote: string;
  category: string;
  competitor: string | null;
  feature_gaps: string[];
  usage_duration: string | null;
  retention_path: string;
  retention_accepted: boolean;
}

interface NotificationEndpoint {
  id: string;
  provider: "webhook" | "slack";
  target_url: string;
  signing_secret: string;
  auth_header_name: string | null;
  auth_header_value: string | null;
  event_type: "interview_completed";
  delivery_mode: "realtime" | "daily" | "weekly";
  enabled: boolean;
}

// --- Prompt builder ---

function buildUserContextBlock(ctx: UserContext | null | undefined): string {
  if (!ctx) return "";

  const lines: string[] = ["## User Context"];
  if (ctx.email)       lines.push(`- Email: ${ctx.email}`);
  if (ctx.plan)        lines.push(`- Plan: ${ctx.plan}`);
  if (ctx.account_age !== undefined) lines.push(`- Account age: ${ctx.account_age} days`);
  if (ctx.seats !== undefined)       lines.push(`- Seats: ${ctx.seats}`);
  if (ctx.mrr !== undefined)         lines.push(`- MRR: $${ctx.mrr}`);

  let guidance = "";
  const age = ctx.account_age;
  if (age !== undefined) {
    if (age <= 7) {
      guidance = "This is a brand-new customer (0–7 days). Likely an onboarding problem — probe setup friction and first impressions.";
    } else if (age <= 30) {
      guidance = "This is an early-adoption customer (8–30 days). Look for product-fit gaps and unmet initial expectations.";
    } else if (age <= 365) {
      guidance = "This is a mid-lifecycle customer (31–365 days). Explore competitive pressure or missing features that have emerged over time.";
    } else {
      guidance = "This is a long-term, loyal customer (1+ year). High value — make a strong, personalised retention case.";
    }
  }

  if (guidance) lines.push("", `Guidance: ${guidance}`);

  return lines.join("\n");
}

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

function matchRule(rules: Rule[], ctx: UserContext | null): string | null {
  if (!ctx || rules.length === 0) return null;

  for (const rule of rules) {
    const results = rule.conditions.map((c) => {
      const actual = (ctx as Record<string, unknown>)[c.variable];
      if (actual === undefined || actual === null) return false;
      const val = c.value;
      switch (c.operator) {
        case "==": return String(actual) === String(val);
        case "!=": return String(actual) !== String(val);
        case ">":  return Number(actual) > Number(val);
        case "<":  return Number(actual) < Number(val);
        case ">=": return Number(actual) >= Number(val);
        case "<=": return Number(actual) <= Number(val);
        case "contains": return String(actual).toLowerCase().includes(String(val).toLowerCase());
        default: return false;
      }
    });

    const matched = rule.conditions.length === 0
      ? false
      : rule.condition_logic === "AND"
        ? results.every(Boolean)
        : results.some(Boolean);

    if (matched) return rule.prompt_addition;
  }
  return null;
}

function buildSystemPrompt(config: AccountConfig, userTurns: number, userContext?: UserContext | null, ruleInjection?: string | null): string {
  const {
    product_name,
    product_description,
    competitors,
    plans,
    retention_paths,
    min_exchanges,
    max_exchanges,
    brand_prompt,
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

  const brandVoiceSection = brand_prompt
    ? `You are an expert copywriter. Always follow these brand guidelines: ${brand_prompt}`
    : "You are an expert copywriter. Keep the tone casual and human — like a quick Slack message, not a corporate email.";

  const userContextBlock = buildUserContextBlock(userContext);
  const ruleInjectionBlock = ruleInjection
    ? `\nVERY IMPORTANT INFORMATION FOR THIS SPECIFIC ACCOUNT:\n${ruleInjection}`
    : "";

  return `${brandVoiceSection}
${userContextBlock ? `\n${userContextBlock}\n` : ""}${ruleInjectionBlock}

You are a friendly exit interview AI for ${product_name}. Your job is to understand WHY a customer is cancelling — not the surface reason, but the real story.

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

function firstUserMessage(messages: Array<{ role: string; content: string }>): string {
  const first = messages.find((m) => m.role === "user" && String(m.content ?? "").trim().toLowerCase() !== "start");
  return String(first?.content ?? "").trim();
}

function lastUserMessage(messages: Array<{ role: string; content: string }>): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (m.role === "user") {
      const c = String(m.content ?? "").trim();
      if (c.toLowerCase() !== "start" && c.length > 0) return c;
    }
  }
  return "";
}

function buildFallbackInsight(messages: Array<{ role: string; content: string }>): InsightPayload {
  const surface = firstUserMessage(messages) || "No clear reason provided";
  const keyQuote = lastUserMessage(messages) || surface;
  return {
    surface_reason: surface,
    deep_reasons: [surface],
    sentiment: "neutral",
    salvageable: false,
    key_quote: keyQuote,
    category: "other",
    competitor: null,
    feature_gaps: [],
    usage_duration: null,
    retention_path: "offboard_gracefully",
    retention_accepted: false,
  };
}

function normalizeInsightPayload(raw: Record<string, unknown> | null, messages: Array<{ role: string; content: string }>): InsightPayload {
  const fallback = buildFallbackInsight(messages);
  if (!raw) return fallback;
  return {
    surface_reason: String(raw.surface_reason ?? fallback.surface_reason),
    deep_reasons: Array.isArray(raw.deep_reasons) ? (raw.deep_reasons as unknown[]).map((v) => String(v)) : fallback.deep_reasons,
    sentiment: String(raw.sentiment ?? fallback.sentiment),
    salvageable: Boolean(raw.salvageable),
    key_quote: String(raw.key_quote ?? fallback.key_quote),
    category: String(raw.category ?? fallback.category),
    competitor: raw.competitor ? String(raw.competitor) : null,
    feature_gaps: Array.isArray(raw.feature_gaps) ? (raw.feature_gaps as unknown[]).map((v) => String(v)) : [],
    usage_duration: raw.usage_duration ? String(raw.usage_duration) : null,
    retention_path: String(raw.retention_path ?? fallback.retention_path),
    retention_accepted: Boolean(raw.retention_accepted),
  };
}

function forceFinalTranscript(rawText: string, messages: Array<{ role: string; content: string }>): { text: string; insight: InsightPayload } {
  const insight = normalizeInsightPayload(parseInsight(rawText), messages);
  const visibleRaw = rawText
    .replace(/\[INSIGHTS\][\s\S]*?\[\/INSIGHTS\]/g, "")
    .replace(/\[INTERVIEW_COMPLETE\]/g, "")
    .trim();

  const visible = visibleRaw.includes("?")
    ? "Thanks for sharing this with us — we appreciate the context and will use it to improve."
    : (visibleRaw || "Thanks for sharing this with us — we appreciate the context and will use it to improve.");

  const text =
    `${visible}\n\n` +
    `[INTERVIEW_COMPLETE]\n\n` +
    `[INSIGHTS]\n${JSON.stringify(insight, null, 2)}\n[/INSIGHTS]`;

  return { text, insight };
}

function textToAnthropicSSE(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const payload =
    `data: ${JSON.stringify({ type: "content_block_delta", delta: { type: "text_delta", text } })}\n\n` +
    `data: [DONE]\n\n`;
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(payload));
      controller.close();
    },
  });
}

async function createPartialInsight(
  supabase: ReturnType<typeof createClient>,
  accountId: string,
  userContext: UserContext | null
): Promise<string | null> {
  const { data, error } = await supabase
    .from("insights")
    .insert({
      account_id: accountId,
      user_email: userContext?.email ?? null,
      user_plan: userContext?.plan ?? null,
      account_age: userContext?.account_age ?? null,
      seats: userContext?.seats ?? null,
      mrr: userContext?.mrr ?? null,
      // required non-null columns get placeholder values
      surface_reason: "",
      deep_reasons: [],
      sentiment: "neutral",
      salvageable: false,
      key_quote: "",
      category: "other",
      feature_gaps: [],
      retention_path: "offboard_gracefully",
      retention_accepted: false,
      raw_transcript: [],
    })
    .select("id")
    .single();
  if (error) console.error("Failed to create partial insight:", error);
  return (data?.id as string | undefined) ?? null;
}

async function saveInsight(
  supabase: ReturnType<typeof createClient>,
  accountId: string,
  insight: InsightPayload,
  messages: Array<{ role: string; content: string }>,
  userContext?: UserContext | null,
  existingInsightId?: string | null
) {
  const payload = {
    account_id: accountId,
    surface_reason: insight.surface_reason,
    deep_reasons: insight.deep_reasons,
    sentiment: insight.sentiment,
    salvageable: insight.salvageable,
    key_quote: insight.key_quote,
    category: insight.category || "other",
    competitor: insight.competitor,
    feature_gaps: insight.feature_gaps,
    usage_duration: insight.usage_duration,
    retention_path: insight.retention_path,
    retention_accepted: insight.retention_accepted,
    raw_transcript: messages,
    user_email: userContext?.email ?? null,
    user_plan: userContext?.plan ?? null,
    account_age: userContext?.account_age ?? null,
    seats: userContext?.seats ?? null,
    mrr: userContext?.mrr ?? null,
  };

  if (existingInsightId) {
    const { error } = await supabase
      .from("insights")
      .update(payload)
      .eq("id", existingInsightId);
    if (error) console.error("Failed to update insight:", error);
    return existingInsightId;
  }

  const { data, error: insertError } = await supabase
    .from("insights")
    .insert(payload)
    .select("id")
    .single();
  if (insertError) console.error("Failed to save insight:", insertError);
  return (data?.id as string | undefined) ?? null;
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const keyData = new TextEncoder().encode(secret);
  const payloadData = new TextEncoder().encode(payload);
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, payloadData);
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function buildNotificationEvent(
  accountId: string,
  insightId: string | null,
  insight: InsightPayload
) {
  return {
    event: "interview_completed",
    account_id: accountId,
    insight_id: insightId,
    occurred_at: new Date().toISOString(),
    insight: {
      surface_reason: insight.surface_reason,
      deep_reasons: insight.deep_reasons,
      category: insight.category,
      salvageable: insight.salvageable,
      retention_path: insight.retention_path,
      key_quote: insight.key_quote,
      sentiment: insight.sentiment,
      competitor: insight.competitor,
      feature_gaps: insight.feature_gaps,
      usage_duration: insight.usage_duration,
    },
  };
}

function buildSlackPayload(event: ReturnType<typeof buildNotificationEvent>) {
  const salvageable = event.insight.salvageable ? "Yes" : "No";
  const deepReasons = event.insight.deep_reasons.length > 0
    ? event.insight.deep_reasons.join(" | ")
    : "None provided";

  return {
    event: event.event,
    account_id: event.account_id,
    insight_id: event.insight_id,
    occurred_at: event.occurred_at,
    surface_reason: event.insight.surface_reason || "N/A",
    deep_reasons: deepReasons,
    category: event.insight.category || "other",
    salvageable,
    retention_path: event.insight.retention_path || "N/A",
    key_quote: event.insight.key_quote || "",
  };
}

async function deliverRealtimeNotifications(
  supabase: ReturnType<typeof createClient>,
  accountId: string,
  insightId: string | null,
  insight: InsightPayload
) {
  const { data: endpoints, error: endpointError } = await supabase
    .from("notification_endpoints")
    .select("id, provider, target_url, signing_secret, auth_header_name, auth_header_value, event_type, delivery_mode, enabled")
    .eq("account_id", accountId)
    .eq("enabled", true)
    .eq("event_type", "interview_completed")
    .eq("delivery_mode", "realtime");

  if (endpointError) {
    console.error("Failed to load notification endpoints:", endpointError);
    return;
  }

  const rows = (endpoints as NotificationEndpoint[] | null) ?? [];
  if (rows.length === 0) return;

  const event = buildNotificationEvent(accountId, insightId, insight);

  for (const endpoint of rows) {
    const bodyObject =
      endpoint.provider === "slack"
        ? buildSlackPayload(event)
        : event;
    const body = JSON.stringify(bodyObject);

    const { data: delivery, error: insertDeliveryError } = await supabase
      .from("notification_deliveries")
      .insert({
        account_id: accountId,
        endpoint_id: endpoint.id,
        insight_id: insightId,
        event_type: "interview_completed",
        status: "skipped",
        payload: bodyObject,
        error_message: "Dispatch pending",
      })
      .select("id")
      .single();

    if (insertDeliveryError || !delivery?.id) {
      console.error("Failed to create delivery row:", insertDeliveryError);
      continue;
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "last-word-webhook/1.0",
    };

    if (endpoint.auth_header_name && endpoint.auth_header_value) {
      headers[endpoint.auth_header_name] = endpoint.auth_header_value;
    }

    if (endpoint.signing_secret) {
      const signature = await hmacSha256Hex(endpoint.signing_secret, body);
      headers["x-lastword-signature"] = `sha256=${signature}`;
    }

    const start = Date.now();
    let timeout: number | undefined;
    try {
      const controller = new AbortController();
      timeout = setTimeout(() => controller.abort(), 5000);
      const resp = await fetch(endpoint.target_url, {
        method: "POST",
        headers,
        body,
        signal: controller.signal,
      });
      if (timeout) clearTimeout(timeout);

      const responseBody = await resp.text();
      await supabase
        .from("notification_deliveries")
        .update({
          status: resp.ok ? "success" : "failed",
          http_status: resp.status,
          duration_ms: Date.now() - start,
          error_message: resp.ok ? null : `HTTP ${resp.status}`,
          response_body: responseBody.slice(0, 2000),
        })
        .eq("id", delivery.id);
    } catch (err) {
      if (timeout) clearTimeout(timeout);
      const message = err instanceof Error ? err.message : "Unknown webhook error";
      await supabase
        .from("notification_deliveries")
        .update({
          status: "failed",
          duration_ms: Date.now() - start,
          error_message: message,
        })
        .eq("id", delivery.id);
    }
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

    const body = await req.json();
    const rawMessages = body.messages;
    const userContext: UserContext | null = body.userContext ?? null;
    let insightId: string | null = body.insightId ?? null;
    const messages = rawMessages.length > 0 ? rawMessages : [{ role: "user", content: "start" }];
    const userTurns = countUserTurns(messages);

    // On the greeting call (empty messages) or first real user message,
    // create a partial insight row so user context is persisted immediately.
    if ((userTurns === 0 || userTurns === 1) && !insightId) {
      insightId = await createPartialInsight(supabase, accountId, userContext);
    }

    const config: AccountConfig = configRow ? {
      product_name: configRow.product_name,
      product_description: configRow.product_description,
      competitors: configRow.competitors ?? [],
      plans: (configRow.plans as Plan[]) ?? [],
      retention_paths: (configRow.retention_paths as RetentionPathConfig) ?? {},
      min_exchanges: clampExchangeLimit(configRow.min_exchanges, 3),
      max_exchanges: clampExchangeLimit(configRow.max_exchanges, 5),
      brand_prompt: configRow.brand_prompt ?? "",
    } : {
      product_name: "our product",
      product_description: "A SaaS product. No specific details configured yet.",
      competitors: [],
      plans: [],
      retention_paths: { offboard_gracefully: { enabled: true } },
      min_exchanges: 3,
      max_exchanges: 5,
      brand_prompt: "",
    };

    if (config.min_exchanges > config.max_exchanges) {
      config.max_exchanges = config.min_exchanges;
    }

    const { data: rulesRows } = await supabase
      .from("rules")
      .select("id, priority, condition_logic, conditions, prompt_addition")
      .eq("account_id", accountId)
      .order("priority", { ascending: true });

    const rules: Rule[] = (rulesRows ?? []) as Rule[];
    const ruleInjection = matchRule(rules, userContext);

    const systemPrompt = buildSystemPrompt(config, userTurns, userContext, ruleInjection);
    const hardStopReached = userTurns >= config.max_exchanges;

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    if (hardStopReached) {
      const forcedPrompt = `${systemPrompt}

## HARD STOP (SERVER ENFORCED)
- Maximum customer replies reached.
- Respond with a final wrap-up now.
- Do not ask any question.
- Include [INTERVIEW_COMPLETE] and [INSIGHTS] in this response.`;

      const forcedResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1024,
          system: forcedPrompt,
          messages,
          stream: false,
        }),
      });

      if (!forcedResponse.ok) {
        const t = await forcedResponse.text();
        console.error("AI gateway error (hard stop):", forcedResponse.status, t);

        const GEMINI_API_KEY = Deno.env.get("VITE_GEMINI_API_KEY");
        if (!GEMINI_API_KEY) {
          return new Response(JSON.stringify({ error: "AI gateway error" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        try {
          const geminiText = await geminiNonStreaming(forcedPrompt, messages, 1024, GEMINI_API_KEY);
          const { text: finalText, insight } = forceFinalTranscript(geminiText, messages);
          await saveInsight(supabase, accountId, insight, messages, userContext, insightId);
          return new Response(textToAnthropicSSE(finalText), {
            headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
          });
        } catch (geminiErr) {
          console.error("Gemini fallback failed (hard-stop):", geminiErr);
          return new Response(JSON.stringify({ error: "AI gateway error" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      const forcedJson = await forcedResponse.json();
      const generatedText = Array.isArray(forcedJson?.content)
        ? forcedJson.content
            .filter((c: Record<string, unknown>) => c?.type === "text")
            .map((c: Record<string, unknown>) => String(c?.text ?? ""))
            .join("")
        : "";

      const { text: finalText, insight } = forceFinalTranscript(generatedText, messages);
      const savedId = await saveInsight(supabase, accountId, insight, messages, userContext, insightId);
      void deliverRealtimeNotifications(supabase, accountId, savedId, insight).catch((e) => {
        console.error("Notification dispatch error:", e);
      });

      return new Response(textToAnthropicSSE(finalText), {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

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
      if (aiResponse.status === 429 || aiResponse.status === 402) {
        const GEMINI_API_KEY = Deno.env.get("VITE_GEMINI_API_KEY");
        if (GEMINI_API_KEY) {
          console.log("exit-interview: Anthropic rate-limited, falling back to Gemini...");
          try {
            const geminiText = await geminiNonStreaming(systemPrompt, messages, 1024, GEMINI_API_KEY);
            if (geminiText.includes("[INTERVIEW_COMPLETE]")) {
              const insight = normalizeInsightPayload(parseInsight(geminiText), messages);
              await saveInsight(supabase, accountId, insight, messages, userContext, insightId);
            }
            return new Response(textToAnthropicSSE(geminiText), {
              headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
            });
          } catch (geminiErr) {
            console.error("Gemini fallback failed (streaming):", geminiErr);
          }
        }
      }
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
          const insight = normalizeInsightPayload(parseInsight(fullText), messages);
          const savedId = await saveInsight(supabase, accountId, insight, messages, userContext, insightId);
          void deliverRealtimeNotifications(supabase, accountId, savedId, insight).catch((e) => {
            console.error("Notification dispatch error:", e);
          });
        }
      } catch (e) {
        console.error("Stream processing error:", e);
      } finally {
        streamController!.close();
      }
    })();

    const responseHeaders: Record<string, string> = { ...corsHeaders, "Content-Type": "text/event-stream" };
    if (insightId) responseHeaders["x-insight-id"] = insightId;

    return new Response(readable, { headers: responseHeaders });
  } catch (e) {
    console.error("exit-interview error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
