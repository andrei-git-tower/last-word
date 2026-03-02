import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, getClientIp, securityHeaders } from "../_shared/security.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  ...securityHeaders,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing x-api-key" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

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
    const clientIp = getClientIp(req);
    const accountRate = await checkRateLimit(`widget-config:acct:${accountId}`, 300, 60_000);
    if (!accountRate.allowed) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
        status: 429,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Retry-After": String(accountRate.retryAfterSec),
        },
      });
    }
    const ipRate = await checkRateLimit(`widget-config:ip:${clientIp}`, 240, 60_000);
    if (!ipRate.allowed) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
        status: 429,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Retry-After": String(ipRate.retryAfterSec),
        },
      });
    }

    const { data: config } = await supabase
      .from("configs")
      .select("brand_primary_color, brand_button_color, brand_font, brand_logo_url, product_name, widget_subtitle, widget_style")
      .eq("account_id", accountId)
      .maybeSingle();

    return new Response(
      JSON.stringify({
        brand_primary_color: config?.brand_primary_color ?? "",
        brand_button_color: config?.brand_button_color ?? "",
        brand_font: config?.brand_font ?? "",
        brand_logo_url: config?.brand_logo_url ?? "",
        brand_name: config?.product_name ?? "",
        widget_subtitle: config?.widget_subtitle ?? "",
        widget_style: config?.widget_style ?? "chat",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[widget-config] Unhandled error:", e);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
