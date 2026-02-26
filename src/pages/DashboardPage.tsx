import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Dashboard } from "@/components/Dashboard";
import { InterviewChat } from "@/components/InterviewChat";
import { toast } from "sonner";
import type { Insight } from "@/lib/constants";

const APP_URL = import.meta.env.VITE_APP_URL ?? window.location.origin;

export default function DashboardPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"insights" | "interview" | "setup">("interview");
  const [testInsights, setTestInsights] = useState<Insight[]>([]);
  const handleTestInsight = useCallback((insight: Insight) => {
    setTestInsights((prev) => [...prev, insight]);
  }, []);

  const { data: insightsRows, isLoading: insightsLoading } = useQuery({
    queryKey: ["insights"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("insights")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

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

  const insights: Insight[] = (insightsRows ?? []).map((row) => ({
    surface_reason: row.surface_reason,
    deep_reasons: row.deep_reasons,
    sentiment: row.sentiment as "positive" | "neutral" | "negative",
    salvageable: row.salvageable,
    key_quote: row.key_quote,
    category: row.category,
    competitor: row.competitor,
    feature_gaps: row.feature_gaps,
    usage_duration: row.usage_duration ?? "",
    date: formatDistanceToNow(new Date(row.created_at), { addSuffix: true }),
    retention_path: row.retention_path,
    retention_accepted: row.retention_accepted,
  }));

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  }

  const apiKey = account?.api_key ?? "";
  const scriptTag = `<script src="${APP_URL}/widget.js" data-api-key="${apiKey}"></script>`;
  const triggerSnippet = `document.getElementById('cancel-btn').addEventListener('click', () => {\n  window.LastWord.open();\n});`;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-4 pb-12">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Last Word</h1>
            <span className="text-xs bg-teal-accent-light text-teal-accent-foreground px-2.5 py-0.5 rounded-full font-semibold">
              AI-Powered
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{user?.email}</span>
            <button
              onClick={handleSignOut}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 bg-card rounded-lg border border-border p-1 w-fit">
          {([["interview", "Test Interview"], ["insights", "Insights"], ["setup", "Setup"]] as const).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Insights tab */}
        {tab === "insights" && (
          insightsLoading ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Loading...</div>
          ) : insights.length === 0 ? (
            <div className="bg-card rounded-xl border border-border p-12 text-center">
              <div className="text-4xl mb-3">💬</div>
              <h2 className="text-base font-semibold text-foreground mb-1">No interviews yet</h2>
              <p className="text-sm text-muted-foreground">
                Add the widget to your cancellation page and interviews will appear here.
              </p>
              <button
                onClick={() => setTab("setup")}
                className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Go to Setup
              </button>
            </div>
          ) : (
            <Dashboard insights={insights} useSampleData={false} />
          )
        )}

        {/* Test Interview tab */}
        {tab === "interview" && (
          account?.api_key ? (
            <InterviewChat
              onInsight={handleTestInsight}
              apiKey={account.api_key}
            />
          ) : (
            <div className="text-sm text-muted-foreground py-8 text-center">Loading...</div>
          )
        )}

        {/* Setup tab */}
        {tab === "setup" && (
          <div className="space-y-4">

            <div className="bg-card rounded-xl border border-border p-5">
              <h3 className="font-semibold text-sm text-foreground mb-1">Your API Key</h3>
              <p className="text-xs text-muted-foreground mb-3">Keep this private — it identifies your account.</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm bg-secondary rounded-lg px-4 py-2.5 font-mono text-foreground truncate">
                  {apiKey || "Loading..."}
                </code>
                <button
                  onClick={() => copy(apiKey, "API key")}
                  className="shrink-0 px-3 py-2.5 bg-secondary text-muted-foreground rounded-lg text-xs hover:text-foreground transition-colors"
                >
                  Copy
                </button>
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border p-5">
              <h3 className="font-semibold text-sm text-foreground mb-1">Add to your cancellation page</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Paste the script tag, then call{" "}
                <code className="text-xs bg-secondary px-1.5 py-0.5 rounded font-mono">window.LastWord.open()</code>{" "}
                when your cancel button is clicked.
              </p>

              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">1. Script tag</span>
                    <button
                      onClick={() => copy(scriptTag, "Script tag")}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                  <pre className="text-xs bg-secondary rounded-lg px-4 py-3 font-mono text-foreground overflow-x-auto whitespace-pre-wrap break-all">
                    {scriptTag}
                  </pre>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">2. Trigger on cancel</span>
                    <button
                      onClick={() => copy(triggerSnippet, "Trigger snippet")}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                  <pre className="text-xs bg-secondary rounded-lg px-4 py-3 font-mono text-foreground overflow-x-auto">
                    {triggerSnippet}
                  </pre>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border p-5">
              <h3 className="font-semibold text-sm text-foreground mb-1">Integration Status</h3>
              <p className="text-xs text-muted-foreground mb-4">
                Shows whether Last Word has received a real API call from your cancellation page.
              </p>
              {insightsLoading ? (
                <div className="text-sm text-muted-foreground">Checking...</div>
              ) : (insightsRows ?? []).length > 0 ? (
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
                  <div>
                    <div className="text-sm font-semibold text-foreground">Active</div>
                    <div className="text-xs text-muted-foreground">API calls are coming in successfully.</div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground shrink-0" />
                  <div>
                    <div className="text-sm font-semibold text-foreground">Not integrated yet</div>
                    <div className="text-xs text-muted-foreground">Waiting for the first API call from your cancellation page.</div>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
