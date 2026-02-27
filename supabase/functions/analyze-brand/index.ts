import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

const BRAND_ANALYSIS_PROMPT = `You are an expert brand strategist and copywriter. I will provide you with scraped content from a company's website.

Your sole task is to extract the brand's abstract VOICE, TONE, SYNTAX, and WRITING STYLE. You must completely separate *how* they write from *what* they are selling.

CRITICAL RULES FOR YOUR ANALYSIS:
1. DO NOT mention the product, service, industry, or specific features (e.g., ignore words like "software", "app", or specific tools).
2. DO NOT mention the target audience or specific personas.
3. DO NOT mention specific pain points or use cases.

Instead, focus STRICTLY on the linguistic mechanics:
- Tone & Vibe: (e.g., authoritative, witty, empathetic, clinical, punchy, calm).
- Syntax & Punctuation: (e.g., short vs. flowing sentences, use of em-dashes, exclamation marks, rhetorical questions).
- Vocabulary Style: (e.g., simple and accessible, highly academic, conversational, colloquial).

Based on this analysis, generate a highly condensed, reusable instruction block (a prompt of 2-3 sentences max) that I can use to make an AI write about ANY totally unrelated topic in this exact brand voice.

OUTPUT INSTRUCTION:
PROVIDE ONLY THE PROMPT!! Do not reply with "Here is the prompt," "Understood," or any conversational filler. The very first character of your response must be the beginning of the prompt itself.

Here is the scraped website content:`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Auth via account api_key — same pattern as exit-interview
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing x-api-key header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: account, error: accountError } = await supabaseAdmin
      .from("accounts")
      .select("id")
      .eq("api_key", apiKey)
      .single();

    console.log("[analyze-brand] account lookup:", { found: !!account, error: accountError?.message });

    if (accountError || !account) {
      return new Response(JSON.stringify({ error: "Invalid API key" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accountId = account.id as string;

    const { scraped_content } = await req.json();
    if (!scraped_content || typeof scraped_content !== "string") {
      return new Response(JSON.stringify({ error: "Missing scraped_content" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[analyze-brand] scraped_content length:", scraped_content.length);

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    // Call Anthropic — non-streaming, we just need the full text back
    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 256,
        messages: [
          {
            role: "user",
            content: `${BRAND_ANALYSIS_PROMPT}\n\n${scraped_content}`,
          },
        ],
      }),
    });

    console.log("[analyze-brand] Anthropic response status:", aiResponse.status);

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("[analyze-brand] Anthropic error:", aiResponse.status, errText);
      return new Response(JSON.stringify({ error: "AI call failed", detail: errText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResponse.json();
    const brand_prompt: string = aiJson?.content?.[0]?.text?.trim() ?? "";

    console.log("[analyze-brand] brand_prompt generated, length:", brand_prompt.length);

    if (!brand_prompt) {
      return new Response(JSON.stringify({ error: "AI returned empty response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // UPDATE only — avoids insert failing on NOT NULL product_name constraint
    const { error: updateError } = await supabaseAdmin
      .from("configs")
      .update({ brand_prompt, updated_at: new Date().toISOString() })
      .eq("account_id", accountId);

    console.log("[analyze-brand] configs update error:", updateError?.message ?? "none");

    if (updateError) {
      console.error("[analyze-brand] Failed to save brand_prompt:", updateError);
      return new Response(JSON.stringify({ error: "Failed to save brand prompt", detail: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ brand_prompt }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-brand error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
