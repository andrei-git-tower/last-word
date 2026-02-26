import { SAMPLE_INSIGHTS, CATEGORY_COLORS, RETENTION_META } from "@/lib/constants";
import { RetentionPathCard } from "./RetentionPathCard";
import type { Insight } from "@/lib/constants";

interface DashboardProps {
  insights: Insight[];
  useSampleData?: boolean;
}

export function Dashboard({ insights, useSampleData = true }: DashboardProps) {
  const all = useSampleData ? [...SAMPLE_INSIGHTS, ...insights] : insights;
  const cats: Record<string, number> = {};
  all.forEach((i) => {
    cats[i.category] = (cats[i.category] || 0) + 1;
  });
  const salvageable = all.filter((i) => i.salvageable).length;
  const saved = all.filter((i) => i.retention_accepted).length;
  const total = all.length;
  const competitors: Record<string, number> = {};
  all.forEach((i) => {
    if (i.competitor) competitors[i.competitor] = (competitors[i.competitor] || 0) + 1;
  });
  const featureGaps: Record<string, number> = {};
  all.forEach((i) => {
    (i.feature_gaps || []).forEach((f) => {
      featureGaps[f] = (featureGaps[f] || 0) + 1;
    });
  });
  const retPaths: Record<string, number> = {};
  all.forEach((i) => {
    if (i.retention_path) retPaths[i.retention_path] = (retPaths[i.retention_path] || 0) + 1;
  });
  const retAccepted: Record<string, number> = {};
  all.forEach((i) => {
    if (i.retention_path && i.retention_accepted) retAccepted[i.retention_path] = (retAccepted[i.retention_path] || 0) + 1;
  });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Interviews", val: total.toString(), sub: "conversations completed", accent: false },
          { label: "Salvageable", val: salvageable.toString(), sub: total > 0 ? `${Math.round((salvageable / total) * 100)}% had a solvable issue` : "—", accent: false },
          { label: "Saved", val: saved.toString(), sub: total > 0 ? `${Math.round((saved / total) * 100)}% accepted retention offer` : "—", accent: true },
          { label: "Save Rate", val: `${salvageable > 0 ? Math.round((saved / salvageable) * 100) : 0}%`, sub: "of salvageable customers kept", accent: true },
        ].map((c, i) => (
          <div key={i} className="bg-card rounded-xl border border-border p-4">
            <div className="text-xs text-muted-foreground font-medium">{c.label}</div>
            <div className={`text-2xl font-bold mt-1 ${c.accent ? "text-teal-accent" : "text-foreground"}`}>{c.val}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{c.sub}</div>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="font-semibold text-foreground mb-4 text-sm">Retention Paths — What Actually Saves Customers</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {Object.entries(retPaths)
            .sort((a, b) => b[1] - a[1])
            .map(([path, count]) => {
              const meta = RETENTION_META[path];
              if (!meta) return null;
              const accepted = retAccepted[path] || 0;
              const rate = Math.round((accepted / count) * 100);
              return (
                <div key={path} className={`rounded-xl border p-4 ${meta.color}`}>
                  <div className="text-2xl mb-1">{meta.icon}</div>
                  <div className="text-sm font-semibold">{meta.label}</div>
                  <div className="text-xs opacity-70 mt-0.5">{meta.desc}</div>
                  <div className="mt-3 flex items-end justify-between">
                    <div>
                      <div className="text-xl font-bold">{count}</div>
                      <div className="text-xs opacity-60">offered</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold">{rate}%</div>
                      <div className="text-xs opacity-60">accepted</div>
                    </div>
                  </div>
                  <div className="mt-2 bg-card/50 rounded-full h-2 overflow-hidden">
                    <div className="h-full rounded-full bg-current opacity-30" style={{ width: `${rate}%` }} />
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-semibold text-foreground mb-4 text-sm">Cancellation Categories</h3>
          <div className="space-y-2.5">
            {Object.entries(cats)
              .sort((a, b) => b[1] - a[1])
              .map(([cat, count]) => {
                const c = CATEGORY_COLORS[cat] || CATEGORY_COLORS.other;
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={cat} className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${c.bg} ${c.text} w-24 text-center shrink-0`}>
                      {c.label}
                    </span>
                    <div className="flex-1 bg-secondary rounded-full h-2.5 overflow-hidden">
                      <div className={`h-full rounded-full ${c.bg} border ${c.border}`} style={{ width: `${Math.max(pct, 8)}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
                  </div>
                );
              })}
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-semibold text-foreground mb-4 text-sm">Feature Gaps Mentioned</h3>
          {Object.keys(featureGaps).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(featureGaps)
                .sort((a, b) => b[1] - a[1])
                .map(([f, c]) => (
                  <div key={f} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{f}</span>
                    <span className="text-xs bg-secondary text-muted-foreground px-2 py-0.5 rounded-full">{c}×</span>
                  </div>
                ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground italic">No specific features mentioned yet</div>
          )}
          <h3 className="font-semibold text-foreground mb-3 mt-6 text-sm">Competitors Mentioned</h3>
          {Object.keys(competitors).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(competitors)
                .sort((a, b) => b[1] - a[1])
                .map(([comp, c]) => (
                  <div key={comp} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{comp}</span>
                    <span className="text-xs bg-red-accent-light text-red-accent-foreground px-2 py-0.5 rounded-full">{c} lost</span>
                  </div>
                ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground italic">No competitors mentioned yet</div>
          )}
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="font-semibold text-foreground mb-4 text-sm">Recent Conversations</h3>
        <div className="space-y-3">
          {all
            .slice()
            .reverse()
            .map((ins, i) => {
              const c = CATEGORY_COLORS[ins.category] || CATEGORY_COLORS.other;
              return (
                <div key={i} className="border border-border rounded-lg p-4 hover:border-muted-foreground/30 transition-colors">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>{c.label}</span>
                    {ins.retention_path && <RetentionPathCard path={ins.retention_path} accepted={ins.retention_accepted} mini />}
                    {ins.competitor && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-accent-light text-red-accent-foreground border border-red-accent">
                        → {ins.competitor}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">
                      {ins.date || "just now"}
                      {ins.usage_duration ? ` · ${ins.usage_duration}` : ""}
                    </span>
                  </div>
                  <div className="text-sm mb-1">
                    <span className="text-muted-foreground">Surface:</span>{" "}
                    <span className="text-foreground font-medium">{ins.surface_reason}</span>
                  </div>
                  <div className="text-sm text-muted-foreground mb-2">
                    <span className="text-muted-foreground">Real reasons:</span> {ins.deep_reasons.join(" · ")}
                  </div>
                  <div className="text-sm italic text-foreground/80 bg-secondary rounded-lg p-3 border-l-2 border-border">
                    &ldquo;{ins.key_quote}&rdquo;
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
