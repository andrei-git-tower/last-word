import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

const SCRAPER_API_KEY = import.meta.env.VITE_SCRAPER_API_KEY as string;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

type Stage = "idle" | "scraping" | "analyzing" | "done" | "error";
type LogoStatus = "idle" | "searching" | "found" | "not_found";
type ColorStatus = "idle" | "searching" | "found" | "not_found";

interface BrandColors {
  primary: string | null;
  button: string | null;
  font: string | null;
}

function StepRow({ label, status, children }: {
  label: string;
  status: "loading" | "complete" | "not_found";
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {status === "loading" ? (
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
        ) : status === "complete" ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500 shrink-0">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground shrink-0">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        )}
        <span className="text-sm text-foreground">
          {label} —{" "}
          <span className={
            status === "loading" ? "text-muted-foreground" :
            status === "complete" ? "text-emerald-500 font-medium" :
            "text-muted-foreground font-medium"
          }>
            {status === "loading" ? "loading" : status === "complete" ? "complete" : "not found"}
          </span>
        </span>
      </div>
      {children}
    </div>
  );
}

function ColorSwatch({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-6 h-6 rounded border border-border shrink-0"
        style={{ backgroundColor: color }}
      />
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-xs font-mono text-foreground">{color}</div>
      </div>
    </div>
  );
}

function extractLogoUrl(html: string, domain: string): string | null {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const baseUrl = `https://${domain}`;
  const IMAGE_EXT = /\.(jpg|jpeg|png|webp|svg|gif|ico)(\?.*)?$/i;
  const domainSlug = domain.split(".")[0].toLowerCase();

  function resolve(url: string): string | null {
    if (!url || url.startsWith("data:")) return null;
    if (url.startsWith("//")) return "https:" + url;
    if (url.startsWith("http")) return url;
    if (url.startsWith("/")) return baseUrl + url;
    return baseUrl + "/" + url;
  }

  const iconLinks: string[] = [];
  doc.querySelectorAll("link[rel]").forEach((el) => {
    const rel = el.getAttribute("rel") ?? "";
    if (/icon|logo|apple-touch/i.test(rel)) {
      const href = resolve(el.getAttribute("href") ?? "");
      if (href && !/favicon/i.test(href)) iconLinks.push(href);
    }
  });

  const ogImage = resolve(doc.querySelector('meta[property="og:image"]')?.getAttribute("content") ?? "");

  function imgsFrom(scope: Element | Document): string[] {
    const srcs: string[] = [];
    scope.querySelectorAll("img").forEach((el) => {
      const src = resolve(
        el.getAttribute("src") || el.getAttribute("data-src") || el.getAttribute("data-lazy-src") || ""
      );
      if (src) srcs.push(src);
    });
    return srcs;
  }

  // Header-scoped search — covers <header>, <nav>, role="banner", and common class names
  const headerSelectors = [
    "header",
    "nav",
    '[role="banner"]',
    '[class*="header"]',
    '[class*="navbar"]',
    '[class*="nav-bar"]',
    '[id*="header"]',
    '[id*="navbar"]',
  ];
  const headerImgs: string[] = [];
  for (const sel of headerSelectors) {
    doc.querySelectorAll(sel).forEach((el) => {
      imgsFrom(el).forEach((src) => {
        if (!headerImgs.includes(src)) headerImgs.push(src);
      });
    });
  }

  // Check header images first, applying the same priority rules
  const headerLogoOrIcon = headerImgs.find(u => /logo|icon/i.test(u) && IMAGE_EXT.test(u));
  if (headerLogoOrIcon) return headerLogoOrIcon;

  const headerWithSlug = headerImgs.find(u => u.toLowerCase().includes(domainSlug) && IMAGE_EXT.test(u));
  if (headerWithSlug) return headerWithSlug;

  const headerFirst = headerImgs.find(u => IMAGE_EXT.test(u));
  if (headerFirst) return headerFirst;

  // Fall through to full-page search
  const imgSrcs = imgsFrom(doc);

  const all = [...iconLinks, ...(ogImage ? [ogImage] : []), ...imgSrcs].filter(u => !/favicon/i.test(u));

  const iconWithLogoName = iconLinks.find(u => /logo|icon/i.test(u) && IMAGE_EXT.test(u));
  if (iconWithLogoName) return iconWithLogoName;

  const withLogoOrIcon = all.find(u => /logo|icon/i.test(u) && IMAGE_EXT.test(u));
  if (withLogoOrIcon) return withLogoOrIcon;

  const withSlug = all.find(u => u.toLowerCase().includes(domainSlug) && IMAGE_EXT.test(u));
  if (withSlug) return withSlug;

  if (iconLinks.length > 0) return iconLinks[0];
  if (ogImage) return ogImage;

  const firstImg = imgSrcs.find(u => IMAGE_EXT.test(u));
  if (firstImg) return firstImg;

  return null;
}

const COLOR_VALUE = /(#[0-9a-fA-F]{3,8}|rgb[a]?\([^)]+\)|hsl[a]?\([^)]+\))/;
const EXCLUDED_COLORS = /^(#fff(fff)?|#000(000)?|white|black|transparent|inherit|initial|currentcolor|none)$/i;

function normalizeColor(raw: string): string | null {
  const c = raw.trim();
  if (!c || EXCLUDED_COLORS.test(c)) return null;
  // Expand 3-digit hex to 6-digit
  if (/^#[0-9a-fA-F]{3}$/.test(c)) {
    return "#" + c[1] + c[1] + c[2] + c[2] + c[3] + c[3];
  }
  return c;
}

function extractBrandColors(html: string): BrandColors {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const allCss = Array.from(doc.querySelectorAll("style")).map(s => s.textContent ?? "").join("\n");
  let m: RegExpExecArray | null;

  // --- Primary color: body background ---

  // 1. Inline style on <body>
  const bodyInline = normalizeColor(
    (doc.body?.style.backgroundColor || doc.body?.style.background) ?? ""
  );

  // 2. CSS rule targeting body/html in <style> tags
  let cssBodyColor: string | null = null;
  const bodyRuleRe = /(?:^|\})\s*(?:body|html)\s*\{([^}]+)\}/gim;
  while ((m = bodyRuleRe.exec(allCss)) !== null) {
    const bgMatch = m[1].match(/background(?:-color)?:\s*([^;}\n]+)/i);
    if (bgMatch) {
      const colorMatch = bgMatch[1].match(COLOR_VALUE);
      if (colorMatch) {
        const c = normalizeColor(colorMatch[1]);
        if (c) { cssBodyColor = c; break; }
      }
    }
  }

  // 3. <meta name="theme-color"> as fallback
  const themeColor = normalizeColor(
    doc.querySelector('meta[name="theme-color"]')?.getAttribute("content") ?? ""
  );

  const primary = bodyInline ?? cssBodyColor ?? themeColor;

  // --- Button color ---

  // 4. Inline styles on prominent button/CTA elements
  let inlineButtonColor: string | null = null;
  const btnSelectors = [
    "button[class*='primary']", "button[class*='btn']", "button[class*='cta']",
    "a[class*='primary']", "a[class*='btn']", "a[class*='cta']",
    "[class*='button--primary']", "[class*='btn-primary']",
  ];
  for (const sel of btnSelectors) {
    const el = doc.querySelector(sel) as HTMLElement | null;
    if (el) {
      const bg = el.style.backgroundColor || el.style.background;
      const c = bg ? normalizeColor(bg) : null;
      if (c) { inlineButtonColor = c; break; }
    }
  }

  // 5. CSS rules for button selectors in <style> tags
  let cssButtonColor: string | null = null;
  const btnRuleRe = /(?:\.btn|\.button|button)[^{]*\{([^}]+)\}/gi;
  while ((m = btnRuleRe.exec(allCss)) !== null) {
    const bgMatch = m[1].match(/background(?:-color)?:\s*([^;}\n]+)/i);
    if (bgMatch) {
      const colorMatch = bgMatch[1].match(COLOR_VALUE);
      if (colorMatch) {
        const c = normalizeColor(colorMatch[1]);
        if (c) { cssButtonColor = c; break; }
      }
    }
  }

  const button = inlineButtonColor ?? cssButtonColor ?? primary;

  // --- Font family ---

  // 1. Inline style on <body>
  let font: string | null = doc.body?.style.fontFamily?.trim() || null;

  // 2. CSS body/html rule in <style> tags
  if (!font) {
    const bodyFontRe = /(?:^|\})\s*(?:body|html)\s*\{([^}]+)\}/gim;
    while ((m = bodyFontRe.exec(allCss)) !== null) {
      const fontMatch = m[1].match(/font-family:\s*([^;}\n]+)/i);
      if (fontMatch) {
        font = fontMatch[1].trim().replace(/^['"]|['"]$/g, "").split(",")[0].trim();
        break;
      }
    }
  }

  // 3. Google Fonts / web font <link> as fallback
  if (!font) {
    doc.querySelectorAll('link[href*="fonts.googleapis.com"], link[href*="fonts.bunny.net"]').forEach((el) => {
      if (font) return;
      const href = el.getAttribute("href") ?? "";
      const familyMatch = href.match(/family=([^&:]+)/);
      if (familyMatch) {
        font = decodeURIComponent(familyMatch[1]).replace(/\+/g, " ").split("|")[0].trim();
      }
    });
  }

  return { primary, button, font };
}

export function BrandingPage({ apiKey }: { apiKey: string }) {
  const { user } = useAuth();
  const [domain, setDomain] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [logoStatus, setLogoStatus] = useState<LogoStatus>("idle");
  const [colorStatus, setColorStatus] = useState<ColorStatus>("idle");
  const [scrapedContent, setScrapedContent] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [brandColors, setBrandColors] = useState<BrandColors>({ primary: null, button: null, font: null });
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
    setLogoStatus("searching");
    setColorStatus("searching");
    setScrapedContent("");
    setLogoUrl("");
    setBrandColors({ primary: null, button: null, font: null });
    setBrandPrompt("");

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
      fetch(`https://api.scraperapi.com/?${textParams.toString()}`).then(r => {
        if (!r.ok) throw new Error(`Scraper text responded with ${r.status}`);
        return r.text();
      }),
      fetch(`https://api.scraperapi.com/?${htmlParams.toString()}`).then(r => {
        if (!r.ok) throw new Error(`Scraper HTML responded with ${r.status}`);
        return r.text();
      }),
    ]);

    if (textResult.status === "rejected") {
      setStage("error");
      toast.error("Failed to scrape the domain. Please try again.");
      setLogoStatus("not_found");
      setColorStatus("not_found");
      return;
    }

    const scraped = textResult.value;
    setScrapedContent(scraped);

    if (htmlResult.status === "fulfilled") {
      const html = htmlResult.value;

      // Logo
      const logo = extractLogoUrl(html, trimmed);
      if (logo) { setLogoUrl(logo); setLogoStatus("found"); }
      else setLogoStatus("not_found");

      // Colors + font
      const colors = extractBrandColors(html);
      if (colors.primary || colors.button || colors.font) {
        setBrandColors(colors);
        setColorStatus("found");
      } else {
        setColorStatus("not_found");
      }

      // Persist to DB
      if (user?.id) {
        supabase
          .from("configs")
          .update({
            brand_logo_url: logo ?? "",
            brand_primary_color: colors.primary ?? "",
            brand_button_color: colors.button ?? "",
            brand_font: colors.font ?? "",
            updated_at: new Date().toISOString(),
          })
          .eq("account_id", user.id)
          .then(({ error }) => {
            if (error) console.error("Failed to save branding fields:", error);
          });
      }
    } else {
      setLogoStatus("not_found");
      setColorStatus("not_found");
    }

    // AI brand voice analysis
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
  const scrapeComplete = stage === "analyzing" || stage === "done" || stage === "error";

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

      {/* Steps + results card */}
      {hasStarted && stage !== "error" && (
        <div className="bg-card rounded-xl border border-border p-5 space-y-5">

          {/* Step 1: Scraping */}
          <StepRow
            label="Scraping with ScraperAPI"
            status={stage === "scraping" ? "loading" : "complete"}
          />

          {/* Step 2: Logo */}
          {logoStatus !== "idle" && (
            <StepRow
              label="Looking for logo"
              status={logoStatus === "searching" ? "loading" : logoStatus === "found" ? "complete" : "not_found"}
            >
              {logoStatus === "found" && logoUrl && (
                <div className="ml-7">
                  <a href={logoUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline break-all">
                    {logoUrl}
                  </a>
                </div>
              )}
            </StepRow>
          )}

          {/* Step 3: Colors */}
          {colorStatus !== "idle" && (
            <StepRow
              label="Extracting brand colors"
              status={colorStatus === "searching" ? "loading" : colorStatus === "found" ? "complete" : "not_found"}
            >
              {colorStatus === "found" && (brandColors.primary || brandColors.button || brandColors.font) && (
                <div className="ml-7 flex items-center gap-6 flex-wrap">
                  {brandColors.primary && (
                    <ColorSwatch color={brandColors.primary} label="Primary" />
                  )}
                  {brandColors.button && brandColors.button !== brandColors.primary && (
                    <ColorSwatch color={brandColors.button} label="Button" />
                  )}
                  {brandColors.font && (
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded border border-border bg-secondary shrink-0 flex items-center justify-center text-[10px] font-bold text-foreground">
                        Aa
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Font</div>
                        <div className="text-xs font-mono text-foreground">{brandColors.font}</div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </StepRow>
          )}

          {/* Scraped content */}
          {scrapeComplete && scrapedContent && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Scraped content</span>
                <button
                  onClick={() => { navigator.clipboard.writeText(scrapedContent); toast.success("Copied to clipboard"); }}
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

          {/* Step 4: AI analysis */}
          {(stage === "analyzing" || stage === "done") && (
            <StepRow
              label="Sending this to AI to generate brand voice & tone"
              status={stage === "analyzing" ? "loading" : "complete"}
            />
          )}

          {/* Brand prompt */}
          {stage === "done" && brandPrompt && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Brand voice prompt</span>
                <button
                  onClick={() => { navigator.clipboard.writeText(brandPrompt); toast.success("Copied to clipboard"); }}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Copy
                </button>
              </div>
              <p className="text-sm text-foreground bg-secondary rounded-lg px-4 py-3 leading-relaxed">
                {brandPrompt}
              </p>
              <div className="flex items-center gap-3 mt-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500 shrink-0">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span className="text-sm text-foreground">
                  Saved — injected into all future interview prompts —{" "}
                  <span className="text-emerald-500 font-medium">complete</span>
                </span>
              </div>
            </div>
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
              onClick={() => { navigator.clipboard.writeText(existingPrompt); toast.success("Copied to clipboard"); }}
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
