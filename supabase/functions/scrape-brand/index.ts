import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, getClientIp, securityHeaders } from "../_shared/security.ts";

// Dashboard-only function — restrict to configured origin when ALLOWED_ORIGIN is set.
// Same env var as analyze-brand. Falls back to "*" if not configured (e.g. local dev).
const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") ?? "*";

const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
  ...securityHeaders,
};

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
    const accountRate = await checkRateLimit(`scrape-brand:acct:${accountId}`, 20, 60_000);
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
    const ipRate = await checkRateLimit(`scrape-brand:ip:${clientIp}`, 15, 60_000);
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

    const { domain } = await req.json();
    if (!domain || typeof domain !== "string") {
      return new Response(JSON.stringify({ error: "Missing domain" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedDomain = domain.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
    if (!normalizedDomain) {
      return new Response(JSON.stringify({ error: "Invalid domain" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Reject path traversal, localhost, and private IP patterns
    const domainHost = normalizedDomain.split("/")[0].split(":")[0].toLowerCase();
    const privateHostPattern = /^(localhost|.*\.local|.*\.internal|metadata\.google\.internal)$/;
    const privateIpPattern = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|169\.254\.|::1|fe80:|fc|fd)/;
    if (
      normalizedDomain.includes("..") ||
      privateHostPattern.test(domainHost) ||
      privateIpPattern.test(domainHost)
    ) {
      return new Response(JSON.stringify({ error: "Invalid domain" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fullUrl = `https://${normalizedDomain}`;
    const SCRAPER_API_KEY = Deno.env.get("SCRAPER_API_KEY");
    if (!SCRAPER_API_KEY) {
      throw new Error("SCRAPER_API_KEY is not configured");
    }

    const textParams = new URLSearchParams({
      api_key: SCRAPER_API_KEY,
      url: fullUrl,
      premium: "true",
      ultra_premium: "true",
      output_format: "text",
    });

    const htmlParams = new URLSearchParams({
      api_key: SCRAPER_API_KEY,
      url: fullUrl,
      premium: "true",
      ultra_premium: "true",
    });

    const [textResult, htmlResult] = await Promise.allSettled([
      fetch(`https://api.scraperapi.com/?${textParams.toString()}`).then((r) => {
        if (!r.ok) throw new Error(`Scraper text responded with ${r.status}`);
        return r.text();
      }),
      fetch(`https://api.scraperapi.com/?${htmlParams.toString()}`).then((r) => {
        if (!r.ok) throw new Error(`Scraper HTML responded with ${r.status}`);
        return r.text();
      }),
    ]);

    if (textResult.status === "rejected") {
      console.error("[scrape-brand] Scraper text failed:", textResult.reason);
      return new Response(JSON.stringify({ error: "Failed to scrape text" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const scraped_text = textResult.value;
    const scraped_html = htmlResult.status === "fulfilled" ? htmlResult.value : null;

    return new Response(JSON.stringify({ scraped_text, scraped_html }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[scrape-brand] Unhandled error:", e);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
