import { RETENTION_META } from "@/lib/constants";

const EXAMPLES: Record<string, { trigger: string; response: string; why: string }> = {
  pause: {
    trigger: '"Budget got cut this quarter"',
    response: "Mention they can pause auto-renewal and keep access through their current billing cycle.",
    why: "Cancelling over temporary budget issues loses customers permanently for a solvable problem.",
  },
  downgrade: {
    trigger: '"I only use commit and push — $69/yr is steep"',
    response: "Suggest a solo/lite tier (or waitlist one). Show you heard them.",
    why: "These users enjoy Tower but can't justify the price for 20% of features.",
  },
  fix_and_followup: {
    trigger: '"Tower crashes every time I open our monorepo"',
    response: "Apologize, create an eng ticket, and promise a personal follow-up within a week.",
    why: "A discount on a broken product is insulting. Fixing it shows respect.",
  },
  early_access: {
    trigger: '"GitKraken\'s merge conflict editor is just better"',
    response: 'If you\'re building something competitive: "We\'re shipping a new conflict resolver in 6 weeks — want early access?"',
    why: "Specific feature gaps are the highest-signal feedback.",
  },
  offboard_gracefully: {
    trigger: '"Company is shutting down" or "Switched to terminal to learn Git"',
    response: "Thank them genuinely. No save attempt. Ask if we can stay in touch.",
    why: "Respecting unsolvable departures builds long-term brand equity.",
  },
  concierge_onboarding: {
    trigger: '"Only 2 of 8 devs actually use it"',
    response: "Offer a free 30-min team onboarding session.",
    why: "Low adoption isn't a product problem — it's an enablement problem.",
  },
};

export function RetentionPlaybook() {
  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-primary to-primary/80 rounded-xl p-6 text-primary-foreground">
        <h2 className="text-lg font-semibold mb-2">Smart Retention — Not Discounts</h2>
        <p className="text-sm opacity-80 leading-relaxed">
          Instead of training customers to cancel for a discount, the AI identifies the real problem and routes to the right solution. Each path addresses a different root cause.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(RETENTION_META).map(([key, meta]) => {
          const ex = EXAMPLES[key];
          if (!ex) return null;
          return (
            <div key={key} className={`rounded-xl border-2 p-5 ${meta.color}`}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">{meta.icon}</span>
                <div>
                  <div className="font-semibold text-sm">{meta.label}</div>
                  <div className="text-xs opacity-70">{meta.desc}</div>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wide opacity-50">Customer says</span>
                  <div className="italic mt-0.5">{ex.trigger}</div>
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wide opacity-50">AI offers</span>
                  <div className="mt-0.5">{ex.response}</div>
                </div>
                <div className="pt-2 border-t border-current/10">
                  <span className="text-xs font-semibold uppercase tracking-wide opacity-50">Why not a discount?</span>
                  <div className="text-xs mt-0.5 opacity-80">{ex.why}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">🚫</span>
          <h3 className="font-semibold text-foreground text-sm">Why Not Discounts?</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          {[
            { title: "Trains bad behavior", desc: 'Word spreads: "Just hit cancel and they\'ll give you 30% off."' },
            { title: "Doesn't solve anything", desc: "20% off a crashing app just delays the inevitable by one billing cycle." },
            { title: "Punishes loyalty", desc: "Your happiest customers pay full price. Your least happy get discounts." },
          ].map((item) => (
            <div key={item.title} className="p-3 bg-red-accent-light rounded-lg border border-red-accent/20">
              <div className="font-medium text-red-accent-foreground mb-1">{item.title}</div>
              <div className="text-xs text-red-accent-foreground/80">{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
