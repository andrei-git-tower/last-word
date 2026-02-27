import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const SCRAPER_API_KEY = "de3bfafaa930e82099f66a7ab7bb18fe";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

type Stage = "idle" | "scraping" | "analyzing" | "done" | "error";

function StepRow({
  label,
  status,
}: {
  label: string;
  status: "loading" | "complete";
}) {
  return (
    <div className="flex items-center gap-3">
      {status === "loading" ? (
        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500 shrink-0">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
      <span className="text-sm text-foreground">
        {label} —{" "}
        <span className={status === "loading" ? "text-muted-foreground" : "text-emerald-500 font-medium"}>
          {status === "loading" ? "loading" : "complete"}
        </span>
      </span>
    </div>
  );
}

export function BrandingPage({ apiKey }: { apiKey: string }) {
  const [domain, setDomain] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [scrapedContent, setScrapedContent] = useState("");
  const [brandPrompt, setBrandPrompt] = useState("");
  const [existingPrompt, setExistingPrompt] = useState("");

  useEffect(() => {
    supabase
      .from("configs")
      .select("brand_prompt")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.brand_prompt) setExistingPrompt(data.brand_prompt);
      });
  }, []);

  async function handleRun() {
    const trimmed = domain.trim();
    if (!trimmed) {
      toast.error("Please enter a domain.");
      return;
    }

    const fullUrl = `https://${trimmed}`;
    setStage("scraping");
    setScrapedContent("");
    setBrandPrompt("");

    // Step 1: Scrape
    let scraped = "";
    try {
      const params = new URLSearchParams({
        api_key: SCRAPER_API_KEY,
        url: fullUrl,
        premium: "true",
        ultra_premium: "true",
        output_format: "text",
      });
      const response = await fetch(`https://api.scraperapi.com/?${params.toString()}`);
      if (!response.ok) throw new Error(`Scraper responded with ${response.status}`);
      scraped = await response.text();
      setScrapedContent(scraped);
    } catch {
      setStage("error");
      toast.error("Failed to scrape the domain. Please try again.");
      return;
    }

    // Step 2: Analyze brand with AI
    setStage("analyzing");
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/analyze-brand`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          "x-api-key": apiKey,
        },
        body: JSON.stringify({ scraped_content: scraped }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `AI call failed with ${res.status}`);
      }

      const { brand_prompt } = await res.json();
      setBrandPrompt(brand_prompt);
      setExistingPrompt(brand_prompt);
      setStage("done");
      toast.success("Brand voice saved.");
    } catch (err) {
      setStage("error");
      toast.error(err instanceof Error ? err.message : "AI analysis failed.");
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleRun();
  }

  const isLoading = stage === "scraping" || stage === "analyzing";
  const hasStarted = stage !== "idle";

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Input card */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="font-semibold text-sm text-foreground mb-1">Your Website</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Enter your domain so we can scrape your site and tailor the interview experience to your brand.
        </p>

        <div className="flex items-center gap-2">
          <div className="shrink-0 flex items-center px-3 py-2.5 bg-secondary rounded-lg border border-border text-sm text-muted-foreground font-mono select-none">
            https://
          </div>

          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="yourdomain.com"
            disabled={isLoading}
            className="flex-1 text-sm bg-background border border-border rounded-lg px-3 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
          />

          <button
            onClick={handleRun}
            disabled={isLoading}
            className="shrink-0 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Working…" : "Analyze"}
          </button>
        </div>

      </div>

      {/* Error */}
      {stage === "error" && (
        <div className="bg-card rounded-xl border border-destructive/30 p-5">
          <p className="text-sm text-destructive">
            Something went wrong. Make sure you entered a valid domain (e.g.{" "}
            <code className="font-mono text-xs">yourdomain.com</code>) and try again.
          </p>
        </div>
      )}

      {/* Step 1: Scraping */}
      {hasStarted && stage !== "error" && (
        <div className="bg-card rounded-xl border border-border p-5 space-y-5">
          <StepRow
            label="Scraping with ScraperAPI"
            status={stage === "scraping" ? "loading" : "complete"}
          />

          {/* Scraped content — shown once scraping is done */}
          {scrapedContent && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Scraped content</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(scrapedContent);
                    toast.success("Copied to clipboard");
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Copy
                </button>
              </div>
              <pre className="text-xs bg-secondary rounded-lg px-4 py-3 font-mono text-foreground overflow-x-auto overflow-y-auto whitespace-pre-wrap break-words max-h-64">
                {scrapedContent}
              </pre>
            </div>
          )}

          {/* Step 2: AI analysis — shown once scraping is done */}
          {(stage === "analyzing" || stage === "done") && (
            <>
              <StepRow
                label="Sending this to AI to generate brand voice & tone"
                status={stage === "analyzing" ? "loading" : "complete"}
              />

              {/* Brand prompt — shown once AI is done */}
              {brandPrompt && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Brand voice prompt</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(brandPrompt);
                        toast.success("Copied to clipboard");
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                  <p className="text-sm text-foreground bg-secondary rounded-lg px-4 py-3 leading-relaxed">
                    {brandPrompt}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Saved — injected into all future interview prompts.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Existing saved prompt (idle state) */}
      {stage === "idle" && existingPrompt && (
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-sm text-foreground">Saved Brand Voice Prompt</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Currently injected into all interview prompts.</p>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(existingPrompt);
                toast.success("Copied to clipboard");
              }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              Copy
            </button>
          </div>
          <p className="text-sm text-foreground bg-secondary rounded-lg px-4 py-3 leading-relaxed">
            {existingPrompt}
          </p>
        </div>
      )}

    </div>
  );
}
