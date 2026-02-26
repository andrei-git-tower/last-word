import { useState, useCallback } from "react";
import { InterviewChat } from "@/components/InterviewChat";
import { Dashboard } from "@/components/Dashboard";
import { RetentionPlaybook } from "@/components/RetentionPlaybook";
import type { Insight } from "@/lib/constants";

type Tab = "interview" | "dashboard" | "paths";

const TABS: { id: Tab; label: string }[] = [
  { id: "interview", label: "Live Interview" },
  { id: "dashboard", label: "Insights Dashboard" },
  { id: "paths", label: "Retention Playbook" },
];

const Index = () => {
  const [tab, setTab] = useState<Tab>("interview");
  const [allInsights, setAllInsights] = useState<Insight[]>([]);

  const handleInsight = useCallback((insight: Insight) => {
    setAllInsights((prev) => [...prev, insight]);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-4 pb-12">
        <div className="mb-5">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Tower Exit Interviews</h1>
            <span className="text-xs bg-teal-accent-light text-teal-accent-foreground px-2.5 py-0.5 rounded-full font-semibold">
              AI-Powered
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Conversations that surface real reasons — and smart retention paths that aren't discounts
          </p>
        </div>

        <div className="flex gap-1 mb-5 bg-card rounded-lg border border-border p-1 w-fit">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "interview" && <InterviewChat onInsight={handleInsight} />}
        {tab === "dashboard" && <Dashboard insights={allInsights} />}
        {tab === "paths" && <RetentionPlaybook />}
      </div>
    </div>
  );
};

export default Index;