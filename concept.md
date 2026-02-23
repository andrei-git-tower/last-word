# Concept Overview

---

### Goal(s)

- Replace our static cancellation survey with an AI conversation that surfaces the real reasons customers leave
- Extract structured, actionable insights from every cancellation and cluster them into patterns
- Route customers to smart retention paths based on their actual problem — no blanket discounts

## Problem Statement

<aside>
💬 What problem are you trying to solve and why is this important?

Our current exit survey gives us almost zero actionable signal. Customers pick "too expensive," skip the text fields, and we learn almost nothing. We're losing salvageable customers because we can't respond to their real issues in the moment.

**

</aside>

## Summary

An AI agent replaces the "Help Us Get Better" form with a short (3–5 exchange) conversation. It digs past surface reasons, extracts structured data (category, deep reasons, competitor, feature gaps, key quote, salvageability), and routes each customer to the right retention path. Insights feed a dashboard that shows churn patterns over time.

**Retention paths (never a discount):**

| Path | Trigger | Offer | Notes |
| --- | --- | --- | --- |
| Pause Auto-Renewal | Temporary budget issue, taking a break | Pause renewal — they keep access through current billing cycle  | perhaps redundant as they can do this themselves |
| Downgrade Pro→Basic  | Only uses basic features, price mismatch | lower plan  |  |
| Fix & Follow Up | Specific bug or performance issue | Eng ticket + personal follow-up |  |
| Early Access | Leaving for a competitor feature | Preview of upcoming feature | TAKE OUT  |
| Concierge Onboarding | Team never properly adopted | Free team onboarding session  | need to set guidelines here!!! Must be multi seat account  |
| Graceful Offboard | Unsolvable (company closing, career change) | Thank warmly, no save attempt |  |

Note: Cause we already offer pause (auto-renewal pause with access through current cycle)- the AI should surface this option contextually when relevant, not as a blanket offer.

# Concept Details

---

## Audience

- Us— Product (feature gaps, competitor intel), Pricing (tier demand signals), Support (reliability issues, churn drivers, save rates).

## Deliverables

- AI conversation agent — interview flow, system prompt, tone, retention path routing
- Insights dashboard — cancellation categories, retention path effectiveness, competitor mentions, feature gaps, save rates
- Cancellation flow integration — replace static survey with conversational UI
- Retention path backends — pause surfacing, downgrade/waitlist, eng ticket routing, onboarding scheduling
- Weekly/Monthly reporting — top churn themes, spike alerts

## Stakeholders or Team members

## Timeline

 **

- Weeks 1–2: Finalize prompt, tone, retention paths. Internal testing with prototype.
- Weeks 3–4: Build cancellation flow integration + basic dashboard.
- Weeks 5–6: Retention path backends.
- Weeks 7–8: Soft launch (10–20% of cancellations, A/B vs current survey).
- Week 9+: Full rollout, iterate based on real data.

## Risks

- Customers find it intrusive — Keep to 3–5 exchanges, make it skippable, A/B test completion rates.
- AI goes off-brand — Strong prompt guardrails, log all conversations during soft launch.
- API failure blocks cancellation — Graceful fallback (single open-text question), never block the cancel action.
- Privacy — Customers may share sensitive info. Define data retention policies, ensure GDPR compliance for EU users.
