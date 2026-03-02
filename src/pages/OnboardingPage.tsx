import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BrandingPage } from "@/components/BrandingPage";
import { InterviewChat } from "@/components/InterviewChat";
import type { Insight } from "@/lib/constants";

const APP_URL = import.meta.env.VITE_APP_URL ?? window.location.origin;
const LS_KEY = "lw_onboarding_step";

type Step = 1 | 2 | 3 | 4;

// ── Progress pills ──────────────────────────────────────────────────────────

function ProgressBar({ step }: { step: Step }) {
  return (
    <div className="flex items-center gap-1.5">
      {([1, 2, 3, 4] as Step[]).map((n) => (
        <div
          key={n}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            n < step
              ? "bg-primary w-6"
              : n === step
              ? "bg-primary w-10"
              : "bg-border w-6"
          }`}
        />
      ))}
    </div>
  );
}

// ── Snippet block ───────────────────────────────────────────────────────────

function SnippetBlock({
  label,
  display,
  copyValue,
}: {
  label: string;
  display: string;
  copyValue: string;
}) {
  function copy() {
    navigator.clipboard.writeText(copyValue);
    toast.success(`${label} copied`);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </span>
        <button
          onClick={copy}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Copy
        </button>
      </div>
      <pre className="text-xs bg-secondary rounded-lg px-4 py-3 font-mono text-foreground overflow-x-auto whitespace-pre-wrap break-all">
        {display}
      </pre>
    </div>
  );
}

// ── Step 1: Welcome ─────────────────────────────────────────────────────────

function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="text-center">
      <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-6">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-primary-foreground"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-foreground mb-2">
        You're in. Let's get Last Word live.
      </h2>
      <p className="text-sm text-muted-foreground mb-8 max-w-sm mx-auto">
        Four quick steps and your exit interview widget will be live on your
        cancellation page.
      </p>

      <div className="text-left space-y-3 mb-8 max-w-xs mx-auto">
        {[
          { n: 1, label: "Brand your widget" },
          { n: 2, label: "Install the script tag" },
          { n: 3, label: "Test the interview" },
        ].map(({ n, label }) => (
          <div key={n} className="flex items-center gap-3 text-sm text-foreground">
            <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center shrink-0 text-xs font-semibold text-muted-foreground">
              {n}
            </div>
            {label}
          </div>
        ))}
      </div>

      <button
        onClick={onNext}
        className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
      >
        Get started
      </button>
    </div>
  );
}

// ── Step 2: Branding ────────────────────────────────────────────────────────

function StepBranding({
  apiKey,
  onBack,
  onNext,
}: {
  apiKey: string;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground mb-1">Brand your widget</h2>
        <p className="text-sm text-muted-foreground">
          Enter your domain and we'll extract your logo, colours, and brand voice automatically.
        </p>
      </div>

      {apiKey ? (
        <BrandingPage apiKey={apiKey} />
      ) : (
        <div className="text-sm text-muted-foreground py-8 text-center">
          Loading your account...
        </div>
      )}

      <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
        <button
          onClick={onBack}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Back
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={onNext}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip for now
          </button>
          <button
            onClick={onNext}
            className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Step 3: Install ─────────────────────────────────────────────────────────

function StepInstall({
  apiKey,
  onBack,
  onNext,
}: {
  apiKey: string;
  onBack: () => void;
  onNext: () => void;
}) {
  const maskedApiKey = apiKey ? apiKey.slice(0, 3) + "•".repeat(apiKey.length - 3) : "";
  const scriptTag = `<script src="${APP_URL}/widget.js" data-api-key="${apiKey}"></script>`;
  const maskedScriptTag = `<script src="${APP_URL}/widget.js" data-api-key="${maskedApiKey}"></script>`;
  const triggerSnippet = `document.getElementById('cancel-btn').addEventListener('click', () => {\n  window.LastWord.open();\n});`;
  const userContextSnippet = `window.LastWord.open({\n  email:       currentUser.email,\n  plan:        currentUser.planName,   // e.g. "pro"\n  account_age: currentUser.daysOld,    // days since signup\n  seats:       currentUser.seats,      // number of seats\n  mrr:         currentUser.mrr,        // monthly spend in USD\n});`;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground mb-1">Install the widget</h2>
        <p className="text-sm text-muted-foreground">
          Paste the script tag into your cancellation page, then call{" "}
          <code className="text-xs bg-secondary px-1.5 py-0.5 rounded font-mono">
            window.LastWord.open()
          </code>{" "}
          when your cancel button is clicked.
        </p>
      </div>

      <div className="space-y-4">
        <SnippetBlock
          label="1. Script tag"
          display={maskedScriptTag}
          copyValue={scriptTag}
        />
        <SnippetBlock
          label="2. Trigger on cancel"
          display={triggerSnippet}
          copyValue={triggerSnippet}
        />
        <SnippetBlock
          label="3. Pass customer context (recommended)"
          display={userContextSnippet}
          copyValue={userContextSnippet}
        />
        <p className="text-xs text-muted-foreground">
          Passing context lets the AI personalise the conversation. All fields are optional.
        </p>
      </div>

      <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
        <button
          onClick={onBack}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Back
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={onNext}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip for now
          </button>
          <button
            onClick={onNext}
            className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            I've installed it
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Step 4: Test ────────────────────────────────────────────────────────────

function StepTest({
  apiKey,
  config,
  onBack,
  onFinish,
}: {
  apiKey: string;
  config: {
    brand_primary_color: string | null;
    brand_button_color: string | null;
    brand_font: string | null;
    brand_logo_url: string | null;
    product_name: string | null;
    widget_subtitle: string | null;
  } | null | undefined;
  onBack: () => void;
  onFinish: () => void;
}) {
  const handleInsight = useCallback((_insight: Insight) => {}, []);

  const primaryColor = config?.brand_primary_color ?? undefined;
  const buttonColor = config?.brand_button_color ?? undefined;
  const fontFamily = config?.brand_font ?? undefined;
  const logoUrl = config?.brand_logo_url ?? undefined;
  const brandName = config?.product_name ?? undefined;
  const subtitle = config?.widget_subtitle || "We'd like to hear from you";
  const accentColor = buttonColor || primaryColor;
  const firstLetter = brandName ? brandName.charAt(0).toUpperCase() : "";

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-foreground mb-1">Test the interview</h2>
        <p className="text-sm text-muted-foreground">
          This is exactly what your customers will see. Try it out.
        </p>
      </div>

      {apiKey ? (
        <div
          className="rounded-xl border border-border overflow-hidden flex flex-col"
          style={fontFamily ? { fontFamily } : undefined}
        >
          {/* Widget header — mirrors Widget.tsx */}
          <div
            className="flex items-center gap-3 px-4 py-3 shrink-0"
            style={{ backgroundColor: "#111827" }}
          >
            <div
              className="w-9 h-9 rounded-lg shrink-0 overflow-hidden flex items-center justify-center text-white font-bold text-base"
              style={{ backgroundColor: accentColor || "#2563eb" }}
            >
              {logoUrl ? (
                <img src={logoUrl} alt={brandName || "Logo"} className="w-full h-full object-contain" />
              ) : (
                firstLetter
              )}
            </div>
            <div className="min-w-0">
              {brandName && (
                <div className="text-sm font-semibold text-white leading-tight truncate">
                  {brandName}
                </div>
              )}
              <div className="text-xs text-gray-400 leading-tight">{subtitle}</div>
            </div>
          </div>

          {/* Chat */}
          <div className="flex flex-col" style={{ padding: "16px 20px 20px" }}>
            <InterviewChat
              onInsight={handleInsight}
              apiKey={apiKey}
              autoStart={true}
              primaryColor={primaryColor}
              buttonColor={buttonColor}
              fontFamily={fontFamily}
            />
          </div>
        </div>
      ) : (
        <div className="text-sm text-muted-foreground py-8 text-center">
          Loading your account...
        </div>
      )}

      <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
        <button
          onClick={onBack}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Back
        </button>
        <button
          onClick={onFinish}
          className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Looks good, go to dashboard
        </button>
      </div>
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const navigate = useNavigate();

  const savedStep = Number(localStorage.getItem(LS_KEY)) as Step;
  const [step, setStep] = useState<Step>(
    savedStep >= 1 && savedStep <= 4 ? savedStep : 1
  );

  const { data: account } = useQuery({
    queryKey: ["account"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("api_key, email")
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: config } = useQuery({
    queryKey: ["config"],
    queryFn: async () => {
      const { data } = await supabase
        .from("configs")
        .select("brand_primary_color, brand_button_color, brand_font, brand_logo_url, product_name, widget_subtitle")
        .maybeSingle();
      return data;
    },
  });

  const apiKey = account?.api_key ?? "";

  function goToStep(n: Step) {
    setStep(n);
    localStorage.setItem(LS_KEY, String(n));
  }

  function finish() {
    localStorage.removeItem(LS_KEY);
    navigate("/dashboard");
  }

  const STEP_LABELS: Record<Step, string> = {
    1: "Welcome",
    2: "Branding",
    3: "Install",
    4: "Test",
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-2xl flex flex-col gap-6">

        {/* Top bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-primary-foreground"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <span className="font-bold text-foreground tracking-tight">Last Word</span>
          </div>

          <div className="flex items-center gap-3">
            <ProgressBar step={step} />
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              Step {step} of 4 — {STEP_LABELS[step]}
            </span>
          </div>
        </div>

        {/* Card */}
        <div className="bg-card rounded-2xl border border-border p-8">
          {step === 1 && (
            <StepWelcome onNext={() => goToStep(2)} />
          )}
          {step === 2 && (
            <StepBranding
              apiKey={apiKey}
              onBack={() => goToStep(1)}
              onNext={() => goToStep(3)}
            />
          )}
          {step === 3 && (
            <StepInstall
              apiKey={apiKey}
              onBack={() => goToStep(2)}
              onNext={() => goToStep(4)}
            />
          )}
          {step === 4 && (
            <StepTest
              apiKey={apiKey}
              config={config}
              onBack={() => goToStep(3)}
              onFinish={finish}
            />
          )}
        </div>

        {/* Escape hatch */}
        <div className="text-center">
          <button
            onClick={finish}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip setup and go to dashboard
          </button>
        </div>

      </div>
    </div>
  );
}
