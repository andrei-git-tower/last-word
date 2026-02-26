# Last Word — Product Concept

---

## What This Is

A configurable, embeddable exit interview widget for SaaS products. You drop a script tag into your cancellation flow, it pops up a short AI conversation when a user hits cancel, surfaces the real reason they're leaving, routes them to the right retention path, and saves the insight to a dashboard you can review later.

The core insight: cancellation surveys are broken. Customers pick the first option, skip the text field, and you learn nothing. A short AI conversation — 3–5 exchanges — gets the real story.

---

## Problem Statement

Exit surveys give companies almost zero actionable signal. Customers pick "too expensive," skip the text fields, and the company learns nothing. Salvageable customers leave because nobody responded to their actual problem. The data that does come back is unstructured, uncategorized, and impossible to act on at scale.

---

## What It Does

1. **Intercepts cancellation** — when a user clicks cancel in a SaaS product, the widget appears
2. **Runs a short AI interview** — 3–5 exchanges, digs past the surface reason to the real one
3. **Extracts structured insight** — category, deep reasons, sentiment, competitor mentions, feature gaps, salvageability
4. **Routes to a retention path** — a relevant, non-manipulative offer based on what the customer actually said
5. **Saves to a dashboard** — the SaaS team can see patterns, competitor intel, feature gap clusters, save rates

---

## Target Customer

Small-to-medium SaaS companies with real cancellation volume — enough that the dashboard becomes valuable, not so large that they need enterprise compliance and SSO. Founders or product people who care about churn and want signal they can actually act on.

---

## Business Rules

### The Interview

- 3–5 exchanges, then wrap up
- Tone: casual, human, never corporate. No filler phrases.
- Never defensive. Never offer a discount.
- Go deeper on vague answers — "too expensive", "not using it", "found something better" always have a real story behind them

### Retention Paths

The retention path is chosen by the AI based on what the customer says. It is configured per account — each SaaS has different offers and triggers.

| Path | Trigger | What Happens |
|---|---|---|
| Pause | Temporary issue — budget, break, project gap | Surface the pause option (if the product has one) |
| Downgrade | Over-provisioned on tier, price mismatch | Suggest a lighter plan |
| Fix & Follow Up | Specific bug or performance complaint | Acknowledge, promise a ticket and personal follow-up |
| Concierge Onboarding | Team never properly adopted the product | Offer a free onboarding session (multi-seat only) |
| Graceful Offboard | Unsolvable — company closing, career change, genuinely happy elsewhere | Thank warmly, no save attempt |

Rules:
- **Never offer a discount** — discounts train customers to cancel to get one
- **Never block the cancel** — the interview is optional, the cancellation always goes through
- **Only offer Concierge Onboarding to multi-seat accounts**
- Retention path offers should be configured by the account owner, not hardcoded

### Insights Extracted Per Conversation

- Surface reason (what they said first)
- Deep reasons (what the AI uncovered)
- Sentiment
- Salvageable (boolean)
- Key quote (most revealing thing they said)
- Category: `pricing | product_fit | competition | support | reliability | lifecycle | other`
- Competitor mentioned (if any)
- Feature gaps mentioned
- Usage duration
- Retention path triggered
- Whether the customer accepted the offer

---

## What's In Scope

- AI interview engine with configurable system prompt
- Per-account config: product name, competitors, pricing tiers, retention paths and their triggers/copy
- API key auth — one key per account, goes in the script tag
- Insights persistence — every completed interview saved to the account's dashboard
- Embeddable widget — drop a script tag, it works
- Basic dashboard — cancellation categories, save rates, competitor mentions, feature gaps, recent conversations

## What's Out of Scope (for now)

- Billing infrastructure
- Team roles or multi-user accounts
- Webhooks or external integrations
- Onboarding flow beyond "here's your script tag and API key"
- A/B testing infrastructure

---

## Risks

- **Customers find it intrusive** — Keep to 3–5 exchanges, make it skippable, never block the cancel
- **AI goes off-brand** — Config schema must constrain tone and offer types; log all conversations early
- **API failure blocks cancellation** — Widget must have a graceful fallback and never block the cancel action
- **Config is too open-ended** — Schema needs guardrails so it can't produce incoherent AI behavior; test against edge cases before shipping

---

## Success Looks Like

A founder drops the script tag in, configures their product in 15 minutes, and within a week has enough cancellation data to identify their top churn driver — something they didn't know before. They save at least one customer they would have lost.
