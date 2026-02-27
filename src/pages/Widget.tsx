import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { InterviewChat } from "@/components/InterviewChat";
import type { Insight } from "@/lib/constants";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

interface WidgetConfig {
  brand_primary_color: string;
  brand_button_color: string;
  brand_font: string;
  brand_logo_url: string;
}

export default function Widget() {
  const [searchParams] = useSearchParams();
  const apiKey = searchParams.get("key") ?? "";
  const [config, setConfig] = useState<WidgetConfig | null>(null);

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
    window.parent.postMessage({ type: "lastword:complete", insight }, "*");
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

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{ padding: "20px", ...(primaryColor ? { backgroundColor: primaryColor } : {}) }}
    >
      <InterviewChat
        onInsight={handleInsight}
        apiKey={apiKey}
        autoStart
        fullHeight
        primaryColor={primaryColor}
        buttonColor={buttonColor}
        fontFamily={fontFamily}
      />
    </div>
  );
}
