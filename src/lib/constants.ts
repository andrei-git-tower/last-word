export interface Insight {
  surface_reason: string;
  deep_reasons: string[];
  sentiment: "positive" | "neutral" | "negative";
  salvageable: boolean;
  key_quote: string;
  category: string;
  competitor: string | null;
  feature_gaps: string[];
  usage_duration: string;
  date: string;
  retention_path: string;
  retention_accepted: boolean;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string; label: string }> = {
  pricing: { bg: "bg-amber-light", text: "text-amber-foreground", border: "border-amber", label: "Pricing" },
  product_fit: { bg: "bg-purple-accent-light", text: "text-purple-accent-foreground", border: "border-purple-accent", label: "Product Fit" },
  competition: { bg: "bg-red-accent-light", text: "text-red-accent-foreground", border: "border-red-accent", label: "Competition" },
  support: { bg: "bg-blue-accent-light", text: "text-blue-accent-foreground", border: "border-blue-accent", label: "Support" },
  reliability: { bg: "bg-orange-accent-light", text: "text-orange-accent-foreground", border: "border-orange-accent", label: "Reliability" },
  lifecycle: { bg: "bg-teal-accent-light", text: "text-teal-accent-foreground", border: "border-teal-accent", label: "Lifecycle" },
  other: { bg: "bg-secondary", text: "text-muted-foreground", border: "border-border", label: "Other" },
};

export const RETENTION_META: Record<string, { icon: string; label: string; color: string; desc: string }> = {
  pause: { icon: "⏸️", label: "Pause Auto-Renewal", color: "bg-blue-accent-light text-blue-accent-foreground border-blue-accent", desc: "Pause renewal, keep access through current cycle" },
  downgrade: { icon: "📦", label: "Downgrade to Basic", color: "bg-amber-light text-amber-foreground border-amber", desc: "Lighter plan for basic usage" },
  fix_and_followup: { icon: "🔧", label: "Fix & Follow Up", color: "bg-orange-accent-light text-orange-accent-foreground border-orange-accent", desc: "Route to eng, promise follow-up" },
  concierge_onboarding: { icon: "🎓", label: "Concierge Onboarding", color: "bg-teal-accent-light text-teal-accent-foreground border-teal-accent", desc: "Free onboarding session for team" },
  offboard_gracefully: { icon: "👋", label: "Graceful Offboard", color: "bg-secondary text-muted-foreground border-border", desc: "Thank & let go — no save attempt" },
};

export const SAMPLE_INSIGHTS: Insight[] = [
  { surface_reason: "Too expensive", deep_reasons: ["Solo freelancer — $69/yr hard to justify vs free tools", "Only uses basic commit/push features"], sentiment: "neutral", salvageable: true, key_quote: "If there was a solo plan at like $3/mo I'd stay — I don't need the team stuff", category: "pricing", competitor: null, feature_gaps: [], usage_duration: "2 years", date: "2 days ago", retention_path: "downgrade", retention_accepted: true },
  { surface_reason: "Switching to GitKraken", deep_reasons: ["GitKraken's built-in merge conflict editor is better", "Team already standardized on it"], sentiment: "neutral", salvageable: false, key_quote: "The merge conflict resolution in GitKraken just saved us so much time", category: "competition", competitor: "GitKraken", feature_gaps: ["merge conflict editor"], usage_duration: "1 year", date: "3 days ago", retention_path: "offboard_gracefully", retention_accepted: false },
  { surface_reason: "Features didn't meet my needs", deep_reasons: ["No built-in code review workflow", "Missing GitHub PR integration depth"], sentiment: "negative", salvageable: true, key_quote: "I kept switching between Tower and the browser for PR reviews", category: "product_fit", competitor: null, feature_gaps: ["code review", "PR integration"], usage_duration: "6 months", date: "5 days ago", retention_path: "fix_and_followup", retention_accepted: true },
  { surface_reason: "Technical issues", deep_reasons: ["Crashes when opening large monorepo", "Performance degrades with 50+ branches"], sentiment: "negative", salvageable: true, key_quote: "Every morning I'd open our repo and wait 45 seconds — I started just using the terminal", category: "reliability", competitor: "command line", feature_gaps: ["large repo performance"], usage_duration: "3 years", date: "1 week ago", retention_path: "fix_and_followup", retention_accepted: true },
  { surface_reason: "Company closing", deep_reasons: ["Really enjoyed using Tower", "Would recommend to next team"], sentiment: "positive", salvageable: false, key_quote: "Tower was the best Git client I've used — I'll push for it wherever I land next", category: "lifecycle", competitor: null, feature_gaps: [], usage_duration: "4 years", date: "1 week ago", retention_path: "offboard_gracefully", retention_accepted: false },
  { surface_reason: "Budget cuts this quarter", deep_reasons: ["CFO slashing all non-essential tools", "Team still wants Tower"], sentiment: "neutral", salvageable: true, key_quote: "We'll probably want to come back in Q2 once budgets reset", category: "pricing", competitor: null, feature_gaps: [], usage_duration: "18 months", date: "9 days ago", retention_path: "pause", retention_accepted: true },
  { surface_reason: "Team never adopted it", deep_reasons: ["Only 2 of 8 devs actually used it", "No onboarding — just shared the license"], sentiment: "negative", salvageable: true, key_quote: "It worked great for me but I couldn't get the rest of the team to switch from the terminal", category: "product_fit", competitor: "command line", feature_gaps: [], usage_duration: "5 months", date: "12 days ago", retention_path: "concierge_onboarding", retention_accepted: true },
  { surface_reason: "Went back to command line", deep_reasons: ["Felt like Tower was a crutch", "Wanted to learn Git deeply"], sentiment: "positive", salvageable: false, key_quote: "Nothing wrong with Tower — I just realized I was avoiding learning Git properly", category: "product_fit", competitor: "command line", feature_gaps: [], usage_duration: "8 months", date: "2 weeks ago", retention_path: "offboard_gracefully", retention_accepted: false },
];

export function parseInsights(text: string): Insight | null {
  const m = text.match(/\[INSIGHTS\]\s*([\s\S]*?)\s*\[\/INSIGHTS\]/);
  if (m) {
    try {
      return JSON.parse(m[1]);
    } catch {
      return null;
    }
  }
  return null;
}

export function cleanMessage(text: string): string {
  let visible = text.replace(/\[INTERVIEW_COMPLETE\]/g, "");
  const insightsStart = visible.indexOf("[INSIGHTS]");
  if (insightsStart !== -1) {
    // Hide internal insight payload as soon as it starts streaming, even
    // before [/INSIGHTS] arrives.
    visible = visible.slice(0, insightsStart);
  }
  return visible.trim();
}
