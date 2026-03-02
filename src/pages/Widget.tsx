import { useEffect, useRef, useState } from "react";
import { InterviewChat } from "@/components/InterviewChat";
import { SurveyChat } from "@/components/SurveyChat";
import { TypeformChat } from "@/components/TypeformChat";
import type { Insight } from "@/lib/constants";
import type { UserContext } from "@/lib/chat-stream";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

interface WidgetConfig {
  brand_primary_color: string;
  brand_button_color: string;
  brand_font: string;
  brand_logo_url: string;
  brand_name: string;
  widget_subtitle: string;
  widget_style: "chat" | "survey" | "typeform";
}

export default function Widget() {
  const legacyApiKey = new URLSearchParams(window.location.search).get("key") ?? "";
  const [apiKey, setApiKey] = useState(legacyApiKey);
  const [config, setConfig] = useState<WidgetConfig | null>(null);
  const [userContext, setUserContext] = useState<UserContext | null>(null);
  const [widgetInitialized, setWidgetInitialized] = useState(Boolean(legacyApiKey));
  const [trustedParentOrigin, setTrustedParentOrigin] = useState<string | null>(null);
  const trustedParentOriginRef = useRef<string | null>(null);
  const trustedParentWindowRef = useRef<Window | null>(null);

  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data && e.data.type === "lastword:init" && window !== window.parent) {
        if (trustedParentWindowRef.current && e.source !== trustedParentWindowRef.current) return;
        if (trustedParentOriginRef.current && e.origin !== trustedParentOriginRef.current) return;
        if (typeof e.data.parentOrigin === "string" && e.data.parentOrigin !== e.origin) return;

        if (!trustedParentWindowRef.current && e.source && "postMessage" in (e.source as object)) {
          trustedParentWindowRef.current = e.source as Window;
        }
        if (!trustedParentOriginRef.current) {
          trustedParentOriginRef.current = e.origin;
          setTrustedParentOrigin(e.origin);
        }
        if (typeof e.data.apiKey === "string" && e.data.apiKey.trim()) {
          setApiKey(e.data.apiKey.trim());
        }
        setUserContext(e.data.userContext ?? null);
        setWidgetInitialized(true);
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  useEffect(() => {
    if (!apiKey) return;
    fetch(`${SUPABASE_URL}/functions/v1/widget-config`, {
      headers: {
        Authorization: `Bearer ${PUBLISHABLE_KEY}`,
        "x-api-key": apiKey,
      },
    })
      .then((r) => r.json())
      .then((data) => setConfig(data))
      .catch(() => {/* non-fatal, widget still works without branding */});
  }, [apiKey]);

  function handleInsight(insight: Insight) {
    if (!trustedParentOrigin) return;
    window.parent.postMessage({ type: "lastword:complete", insight }, trustedParentOrigin);
  }

  if (!widgetInitialized) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Initializing widget...</p>
      </div>
    );
  }

  if (!apiKey) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Missing API key.</p>
      </div>
    );
  }

  const primaryColor = config?.brand_primary_color || undefined;
  const buttonColor = config?.brand_button_color || undefined;
  const fontFamily = config?.brand_font || undefined;
  const logoUrl = config?.brand_logo_url || undefined;
  const brandName = config?.brand_name || undefined;
  const subtitle = config?.widget_subtitle || "We'd like to hear from you";
  const accentColor = buttonColor || primaryColor;
  const firstLetter = brandName ? brandName.charAt(0).toUpperCase() : "";

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={fontFamily ? { fontFamily } : undefined}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 shrink-0"
        style={{ backgroundColor: "#111827" }}
      >
        {/* Logo / avatar */}
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

        {/* Name + subtitle */}
        <div className="min-w-0">
          {brandName && (
            <div className="text-sm font-semibold text-white leading-tight truncate">
              {brandName}
            </div>
          )}
          <div className="text-xs text-gray-400 leading-tight">
            {subtitle}
          </div>
        </div>
      </div>

      {/* Chat / Survey / Typeform */}
      <div
        className="flex-1 min-h-0 overflow-hidden flex flex-col"
        style={config?.widget_style === "typeform" ? undefined : { padding: "16px 20px 20px" }}
      >
        {config?.widget_style === "typeform" ? (
          <TypeformChat
            onInsight={handleInsight}
            apiKey={apiKey}
            autoStart={widgetInitialized}
            primaryColor={primaryColor}
            buttonColor={buttonColor}
            fontFamily={fontFamily}
            userContext={userContext}
          />
        ) : config?.widget_style === "survey" ? (
          <SurveyChat
            onInsight={handleInsight}
            apiKey={apiKey}
            autoStart={widgetInitialized}
            primaryColor={primaryColor}
            buttonColor={buttonColor}
            fontFamily={fontFamily}
            userContext={userContext}
          />
        ) : (
          <InterviewChat
            onInsight={handleInsight}
            apiKey={apiKey}
            autoStart={widgetInitialized}
            fullHeight
            primaryColor={primaryColor}
            buttonColor={buttonColor}
            fontFamily={fontFamily}
            userContext={userContext}
          />
        )}
      </div>
    </div>
  );
}
