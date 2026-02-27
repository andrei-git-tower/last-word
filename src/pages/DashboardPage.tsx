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

type Tab = "insights" | "interview" | "setup";

const NAV_ITEMS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: "setup",
    label: "Setup",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    id: "interview",
    label: "Test Interview",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    id: "insights",
    label: "Insights",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" />
      </svg>
    ),
  },
];

const PAGE_TITLES: Record<Tab, { title: string; description: string }> = {
  insights: { title: "Insights", description: "Understand why customers are leaving and how to save them." },
  interview: { title: "Test Interview", description: "Preview the exit interview your customers will experience." },
  setup: { title: "Setup", description: "Install the widget and configure your integration." },
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("interview");
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

  const { title, description } = PAGE_TITLES[tab];

  return (
    <div className="flex h-screen bg-background overflow-hidden">

      {/* Sidebar */}
      <aside className="w-60 shrink-0 flex flex-col bg-card border-r border-border">
        {/* Logo */}
        <div className="px-5 border-b border-border flex items-center" style={{ minHeight: "73px" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary-foreground">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <span className="font-bold text-foreground tracking-tight">Last Word</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                <span className={active ? "text-primary-foreground" : "text-muted-foreground"}>
                  {item.icon}
                </span>
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* User */}
        <div className="px-3 py-4 border-t border-border">
          <div className="flex items-center gap-2.5 px-2 py-2">
            <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center shrink-0 text-xs font-semibold text-muted-foreground uppercase">
              {user?.email?.[0] ?? "?"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-foreground truncate">{user?.email}</div>
            </div>
            <button
              onClick={handleSignOut}
              title="Sign out"
              className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top bar */}
        <header className="shrink-0 border-b border-border bg-card px-8 flex items-center justify-between" style={{ minHeight: "73px" }}>
          <div>
            <h1 className="text-lg font-semibold text-foreground leading-tight">{title}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>

          {tab === "setup" && (insightsRows ?? []).length > 0 ? (
            <div className="flex items-center gap-2 text-xs text-emerald-600 font-medium bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              Integration active
            </div>
          ) : tab === "insights" ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{insights.length}</span> interviews
            </div>
          ) : null}
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto px-8 py-6">

          {/* Insights tab */}
          {tab === "insights" && (
            insightsLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-sm text-muted-foreground">Loading insights...</div>
              </div>
            ) : insights.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mb-4 text-2xl">💬</div>
                <h2 className="text-base font-semibold text-foreground mb-1">No interviews yet</h2>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Add the widget to your cancellation page and interviews will appear here.
                </p>
                <button
                  onClick={() => setTab("setup")}
                  className="mt-5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
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
              <div className="max-w-2xl mx-auto">
                <InterviewChat
                  onInsight={handleTestInsight}
                  apiKey={account.api_key}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-64">
                <div className="text-sm text-muted-foreground">Loading...</div>
              </div>
            )
          )}

          {/* Setup tab */}
          {tab === "setup" && (
            <div className="max-w-2xl mx-auto space-y-4">

              <div className="bg-card rounded-xl border border-border p-5">
                <h3 className="font-semibold text-sm text-foreground mb-1">Your API Key</h3>
                <p className="text-xs text-muted-foreground mb-3">Keep this private — it identifies your account.</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm bg-secondary rounded-lg px-4 py-2.5 font-mono text-foreground truncate tracking-widest">
                    {apiKey ? "•".repeat(32) : "Loading..."}
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
                      <div className="text-xs text-muted-foreground">
                        Last call received {formatDistanceToNow(new Date(insightsRows![0].created_at), { addSuffix: true })}.
                      </div>
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

        </main>
      </div>
    </div>
  );
}
