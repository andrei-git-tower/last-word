# Last Word — Implementation Plan

---

## Current State

The prototype is fully functional as a Tower-specific demo:

- **Frontend**: React + TypeScript + Vite + shadcn/ui, deployed via Lovable
- **Edge function**: `supabase/functions/exit-interview/index.ts` — streams AI responses via Lovable's AI gateway (Gemini)
- **System prompt**: hardcoded for Tower in the edge function
- **Chat client**: `src/lib/chat-stream.ts` — SSE streaming, fully working
- **Insight extraction**: `src/lib/constants.ts` — `parseInsights()` and `cleanMessage()` parse `[INSIGHTS]...[/INSIGHTS]` blocks from the AI response
- **Dashboard**: `src/components/Dashboard.tsx` — shows categories, retention paths, competitors, feature gaps, recent conversations
- **Data**: all in-memory + sample data — nothing persists to a database yet

Everything hardcoded for Tower needs to become config-driven. No auth, no persistence, no widget bundle yet.

---

## Architecture

```
[Customer's SaaS]
    └── <script> tag with API key + config attributes
            │
            ▼
    [Last Word Widget Bundle]  ← iframe popup, vanilla JS script tag
            │  streams chat
            ▼
    [Supabase Edge Function: exit-interview]
            │  reads config from DB by API key
            │  builds dynamic system prompt
            │  calls AI (Anthropic / Gemini)
            │  saves completed insight to DB
            ▼
    [Supabase DB]
            │
            ▼
    [Last Word Dashboard]  ← React app, auth-gated, scoped to account
```

---

## Database Schema

### `accounts`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| email | text | owner email |
| api_key | text | unique, used in script tag |
| created_at | timestamptz | |

### `configs`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| account_id | uuid | FK → accounts |
| product_name | text | e.g. "Tower" |
| product_description | text | 1–2 sentences, slotted into the system prompt |
| competitors | text[] | e.g. ["GitKraken", "Sourcetree"] |
| plans | jsonb | array of `{ name, price }` e.g. `[{ name: "Pro", price: "$69/yr" }]` |
| retention_paths | jsonb | `RetentionPathConfig` object (see Config Schema) |
| updated_at | timestamptz | |

### `insights`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| account_id | uuid | FK → accounts |
| surface_reason | text | |
| deep_reasons | text[] | |
| sentiment | text | positive/neutral/negative |
| salvageable | boolean | |
| key_quote | text | |
| category | text | |
| competitor | text | nullable |
| feature_gaps | text[] | |
| usage_duration | text | nullable |
| retention_path | text | |
| retention_accepted | boolean | |
| raw_transcript | jsonb | full message array |
| created_at | timestamptz | |

---

## Config Schema

The retention paths are a fixed set — the AI already knows what each one means. Accounts just toggle them on/off and provide one line of offer copy. No custom path types.

```typescript
interface AccountConfig {
  product_name: string;        // "Tower"
  product_description: string; // 1-2 sentences, slotted into the system prompt
  competitors: string[];       // e.g. ["GitKraken", "Sourcetree"] — tells AI what to dig into
  plans: Plan[];               // So AI knows what a "downgrade" actually means for this product
  retention_paths: RetentionPathConfig;
}

interface Plan {
  name: string;   // "Pro", "Basic"
  price: string;  // "$69/yr" — display only, AI uses it for context
}

// Fixed set of paths — just toggle and fill in the offer copy
interface RetentionPathConfig {
  pause: {
    enabled: boolean;
    offer: string; // "You can pause auto-renewal and keep access through your current billing cycle"
  };
  downgrade: {
    enabled: boolean;
    offer: string; // "Drop to our Basic plan at $X/yr"
  };
  fix_and_followup: {
    enabled: boolean;
    // No custom copy needed — AI handles this one naturally
  };
  concierge_onboarding: {
    enabled: boolean;
    offer: string; // "We'll do a free onboarding session with your team"
  };
  offboard_gracefully: {
    enabled: boolean; // Almost always true
  };
}
```

### Prompt Builder

`buildSystemPrompt(config: AccountConfig): string` — lives in the edge function. The template is fixed; only the config slots are filled in. Short function, maybe 60–80 lines.

---

## Big Tasks

### 1. Config Schema + Dynamic System Prompt
**Status**: Not started
**Effort**: Low–Medium (3/10) — schema is fixed and opinionated, prompt builder is a short function

- Write `buildSystemPrompt(config)` in the edge function — fills fixed template slots from config
- Replace the hardcoded Tower prompt with the dynamic builder
- Update edge function to load config from DB by API key
- Seed Tower's config as the first row so the existing demo still works

Subtasks:
- [ ] Write `buildSystemPrompt()` function
- [ ] Update edge function to load config from DB by API key
- [ ] Seed Tower config row in `configs` table
- [ ] Smoke test: confirm Tower interview still behaves correctly

---

### 2. Auth + API Keys
**Status**: Not started
**Effort**: Low (3/10) — Supabase handles the heavy lifting

One account per customer, one API key per account. No teams, no roles.

- Supabase email auth for dashboard login
- On signup, generate a `lw_` prefixed UUID API key and store it in `accounts`
- Edge function reads `x-api-key` header, looks up the account, loads their config
- RLS policies: accounts can only read their own insights and config

Subtasks:
- [ ] Create `accounts` table with `api_key` column
- [ ] Supabase auth (email/password) — signup triggers account row creation + API key generation via DB function or edge function
- [ ] Update edge function to authenticate by API key, resolve `account_id`
- [ ] Add RLS to `insights` and `configs` tables
- [ ] Dashboard: login/logout flow, redirect to login if unauthenticated

---

### 3. Data Persistence
**Status**: Not started
**Effort**: Low

When an interview completes (AI emits `[INTERVIEW_COMPLETE]`), save the insight to Supabase.

- The edge function already has the full conversation and the parsed insight
- After parsing `[INSIGHTS]...[/INSIGHTS]`, insert a row into `insights` with the account_id
- The raw transcript (full message array) should also be saved for debugging

Subtasks:
- [ ] Create `insights` table (schema above)
- [ ] Create `configs` table
- [ ] Insert insight row in edge function after interview completes
- [ ] Update Dashboard to query `insights` by account_id instead of using sample data
- [ ] Remove `SAMPLE_INSIGHTS` from constants once real data flows

---

### 4. Widget
**Status**: Not started
**Effort**: Low (3/10) — iframe popup, no style isolation headaches

The widget is a modal overlay with an iframe pointing at a hosted URL. No shadow DOM, no separate React bundle, no CSS conflicts possible. The actual chat UI is a new `/widget` route in the existing React app — `InterviewChat` already exists and mostly works.

**How it works:**
1. Customer adds `<script src="https://app.lastword.dev/widget.js" data-api-key="xxx"></script>` to their page
2. `widget.js` is ~30 lines of vanilla JS — no build step, no framework
3. It exposes `window.LastWord.open()` — the customer calls this when their cancel button is clicked
4. On open: inject a full-screen backdrop div + centered iframe (inline styles, no CSS file)
5. iframe loads `https://app.lastword.dev/widget?key=xxx`
6. That URL is a new route in the existing React app, renders the chat UI
7. When the interview completes, iframe sends `postMessage({ type: 'lastword:done' })` to parent
8. Parent script closes the overlay

**Integration example for the customer:**
```html
<script src="https://app.lastword.dev/widget.js" data-api-key="lw_xxx"></script>
<script>
  document.getElementById('cancel-btn').addEventListener('click', () => {
    window.LastWord.open();
  });
</script>
```

Subtasks:
- [ ] New route `src/pages/Widget.tsx` — renders `InterviewChat` in a minimal full-height layout, no nav
- [ ] `Widget.tsx` reads `?key=` from URL, passes it to the edge function as auth
- [ ] On `[INTERVIEW_COMPLETE]`, call `window.parent.postMessage({ type: 'lastword:done' }, '*')`
- [ ] Write `public/widget.js` — vanilla JS, injects backdrop + iframe, exposes `window.LastWord.open/close`
- [ ] Test on a plain HTML page with conflicting CSS — confirm iframe isolation holds

**Performance: preload the iframe**

On script tag execution (page load), inject the iframe immediately with `visibility: hidden` and `pointer-events: none`. When `window.LastWord.open()` is called, just flip it to visible. By the time the user clicks cancel, the React app is already booted and the first AI request fires instantly — cuts 300–500ms off perceived latency with one line of change.

- [ ] Inject hidden iframe on script load, not on `open()`
- [ ] `open()` just sets `visibility: visible` + shows backdrop

---

### 5. Dashboard (scoped to account)
**Status**: Partially built (uses hardcoded sample data)
**Effort**: Low (2/10) — UI is already built, mostly wiring + auth gating

Two distinct views:

**Insights dashboard** (`/dashboard`) — already built in `Dashboard.tsx`, needs real data:
- Summary stats: total interviews, salvageable count, saved count, save rate
- Cancellation categories breakdown (pricing, product_fit, competition, reliability, lifecycle, other)
- Retention paths — offered vs accepted rate per path
- Competitors mentioned
- Feature gaps mentioned
- Recent conversations — surface reason, deep reasons, key quote, retention path taken

**Setup page** (`/setup`) — not built yet:
- Show API key (with copy button)
- Show ready-to-paste script tag snippet
- Basic account info (email, created date)

Subtasks:
- [ ] Add login/signup page (`src/pages/Auth.tsx`)
- [ ] Protect `/dashboard` and `/setup` routes — redirect to login if unauthenticated
- [ ] Replace `SAMPLE_INSIGHTS` with live Supabase query scoped to `account_id`, using `@tanstack/react-query`
- [ ] Build `src/pages/Setup.tsx` — API key display + copy, script tag snippet
- [ ] Remove `SAMPLE_INSIGHTS` from `constants.ts`

---

## Small Tasks / Cleanup

- [ ] Move `SYSTEM_PROMPT` out of the edge function body — it's being replaced by `buildSystemPrompt()` but the file should be clean
- [ ] Rename the Vite app — currently named `vite_react_shadcn_ts` in `package.json`
- [ ] Environment variable audit — `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are fine; `LOVABLE_API_KEY` lives in Supabase secrets
- [ ] The edge function currently uses `google/gemini-3-flash-preview` via Lovable's gateway — decide whether to switch to Anthropic directly (better for following complex structured prompts)
- [ ] Add a skip/close button to the widget — cancellation must never be blocked
- [ ] Error state in widget: if the edge function fails, show a single text input fallback ("Mind telling us why you're leaving?")

---

## Sequence / Recommended Order

Dependencies flow like this:

```
DB tables (accounts, configs, insights)
        │
        ▼
Auth + API keys
        │
        ├─────────────────────┐
        ▼                     ▼
Config + prompt         Data persistence
                               │
                    ┌──────────┤
                    ▼          ▼
                 Widget    Dashboard
```

1. **DB tables** — create migrations for `accounts`, `configs`, `insights`; unblocks everything
2. **Auth + API keys** — needed before widget or persistence can work end-to-end
3. **Config + prompt** and **data persistence** — can be built in parallel once auth exists
4. **Widget** — needs auth (API key lookup) to work end-to-end
5. **Dashboard** — needs auth (login) and persistence (real data to show)

---

## Open Questions

- **AI provider**: Stay on Gemini via Lovable gateway, or switch to Anthropic claude-haiku-4-5 directly? Anthropic tends to follow structured output instructions more reliably, which matters for the `[INSIGHTS]` block. Decide before building the prompt builder.
- **Config editor**: Does the dashboard need a UI config editor at launch, or is direct DB editing acceptable for the first few customers? Direct DB editing is fine to start.
- **Insight storage timing**: Save insight at end of conversation only (current plan), or also save partial transcripts if the user closes mid-interview?
