import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

type Competitor = {
  id: string;
  name: string;
  questions: string[];
};

const INPUT_CLS =
  "w-full text-sm bg-background border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20";
const LIMIT_UI_MIN = 1;
const LIMIT_UI_MAX = 10;
const DEFAULT_MIN_EXCHANGES = 3;
const DEFAULT_MAX_EXCHANGES = 5;

function normalizeNumericInput(value: string): string {
  if (value === "") return "";
  if (!/^\d+$/.test(value)) return "";
  return String(parseInt(value, 10));
}

function QuestionsEditor({
  questions,
  onChange,
}: {
  questions: string[];
  onChange: (q: string[]) => void;
}) {
  function update(i: number, val: string) {
    const next = [...questions];
    next[i] = val;
    onChange(next);
  }

  function remove(i: number) {
    onChange(questions.filter((_, idx) => idx !== i));
  }

  function add() {
    if (questions.length < 3) onChange([...questions, ""]);
  }

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground block">
        Questions (optional, max 3)
      </label>
      {questions.map((q, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="text"
            value={q}
            onChange={(e) => update(i, e.target.value)}
            placeholder={`Question ${i + 1}`}
            className={INPUT_CLS}
          />
          <button
            type="button"
            onClick={() => remove(i)}
            title="Remove question"
            className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      ))}
      {questions.length < 3 && (
        <button
          type="button"
          onClick={add}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add question
        </button>
      )}
    </div>
  );
}

function CompetitorForm({
  initialName = "",
  initialQuestions = [],
  saveLabel,
  saving,
  onSave,
  onCancel,
}: {
  initialName?: string;
  initialQuestions?: string[];
  saveLabel: string;
  saving: boolean;
  onSave: (name: string, questions: string[]) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [questions, setQuestions] = useState<string[]>(initialQuestions);

  function handleSave() {
    if (!name.trim()) {
      toast.error("Competitor name is required.");
      return;
    }
    onSave(name.trim(), questions.map((q) => q.trim()).filter(Boolean));
  }

  return (
    <div className="border border-border rounded-lg p-4 space-y-3 bg-secondary/30">
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">
          Competitor name <span className="text-destructive">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Acme Corp"
          className={INPUT_CLS}
        />
      </div>
      <QuestionsEditor questions={questions} onChange={setQuestions} />
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? "Saving..." : saveLabel}
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function CompetitorRow({ competitor }: { competitor: Competitor }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSave(name: string, questions: string[]) {
    setSaving(true);
    const { error } = await supabase
      .from("competitors")
      .update({ name, questions })
      .eq("id", competitor.id);
    setSaving(false);
    if (error) {
      toast.error("Failed to save changes.");
      return;
    }
    toast.success("Competitor updated.");
    queryClient.invalidateQueries({ queryKey: ["competitors"] });
    setEditing(false);
  }

  async function handleDelete() {
    setDeleting(true);
    const { error } = await supabase
      .from("competitors")
      .delete()
      .eq("id", competitor.id);
    setDeleting(false);
    if (error) {
      toast.error("Failed to delete competitor.");
      return;
    }
    toast.success("Competitor removed.");
    queryClient.invalidateQueries({ queryKey: ["competitors"] });
  }

  if (editing) {
    return (
      <CompetitorForm
        initialName={competitor.name}
        initialQuestions={competitor.questions}
        saveLabel="Save"
        saving={saving}
        onSave={handleSave}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="border border-border rounded-lg p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground">{competitor.name}</div>
          {competitor.questions.length > 0 && (
            <ul className="mt-1.5 space-y-0.5">
              {competitor.questions.map((q, i) => (
                <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <span className="shrink-0 mt-0.5">•</span>
                  <span>{q}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 mt-0.5">
          <button
            onClick={() => setEditing(true)}
            title="Edit competitor"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            title="Delete competitor"
            className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6" /><path d="M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function AddCompetitorForm({ onCancel }: { onCancel: () => void }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);

  async function handleSave(name: string, questions: string[]) {
    setSaving(true);
    const { error } = await supabase
      .from("competitors")
      .insert({ account_id: user!.id, name, questions });
    setSaving(false);
    if (error) {
      toast.error("Failed to save competitor.");
      return;
    }
    toast.success("Competitor added.");
    queryClient.invalidateQueries({ queryKey: ["competitors"] });
    onCancel();
  }

  return (
    <CompetitorForm
      saveLabel="Add"
      saving={saving}
      onSave={handleSave}
      onCancel={onCancel}
    />
  );
}

export function SettingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [minExchangesInput, setMinExchangesInput] = useState(String(DEFAULT_MIN_EXCHANGES));
  const [maxExchangesInput, setMaxExchangesInput] = useState(String(DEFAULT_MAX_EXCHANGES));
  const [savingLimits, setSavingLimits] = useState(false);

  // Branding state
  const [productName, setProductName] = useState("");
  const [widgetSubtitle, setWidgetSubtitle] = useState("");
  const [widgetStyle, setWidgetStyle] = useState<"chat" | "survey" | "typeform">("chat");
  const [brandPrimaryColor, setBrandPrimaryColor] = useState("");
  const [brandButtonColor, setBrandButtonColor] = useState("");
  const [brandFont, setBrandFont] = useState("");
  const [brandLogoUrl, setBrandLogoUrl] = useState("");
  const [savingBranding, setSavingBranding] = useState(false);

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ["config"],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("configs")
        .select("id, product_name, product_description, competitors, plans, retention_paths, min_exchanges, max_exchanges, brand_primary_color, brand_button_color, brand_font, brand_logo_url, widget_subtitle, widget_style")
        .eq("account_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: competitors, isLoading } = useQuery({
    queryKey: ["competitors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competitors")
        .select("id, name, questions")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Competitor[];
    },
  });

  useEffect(() => {
    if (!config) return;
    setMinExchangesInput(String(config.min_exchanges ?? DEFAULT_MIN_EXCHANGES));
    setMaxExchangesInput(String(config.max_exchanges ?? DEFAULT_MAX_EXCHANGES));
    setProductName(config.product_name ?? "");
    setWidgetSubtitle((config as { widget_subtitle?: string }).widget_subtitle ?? "");
    setWidgetStyle(((config as { widget_style?: string }).widget_style as "chat" | "survey" | "typeform") ?? "chat");
    setBrandPrimaryColor(config.brand_primary_color ?? "");
    setBrandButtonColor(config.brand_button_color ?? "");
    setBrandFont(config.brand_font ?? "");
    setBrandLogoUrl(config.brand_logo_url ?? "");
  }, [config]);

  const minExchanges = Number.parseInt(minExchangesInput, 10);
  const maxExchanges = Number.parseInt(maxExchangesInput, 10);
  const minIsNumber = Number.isInteger(minExchanges);
  const maxIsNumber = Number.isInteger(maxExchanges);
  const minOutOfRange = minExchanges < LIMIT_UI_MIN || minExchanges > LIMIT_UI_MAX;
  const maxOutOfRange = maxExchanges < LIMIT_UI_MIN || maxExchanges > LIMIT_UI_MAX;
  const invalidRange = !minIsNumber || !maxIsNumber || minOutOfRange || maxOutOfRange || minExchanges > maxExchanges;
  const savedMin = config?.min_exchanges ?? DEFAULT_MIN_EXCHANGES;
  const savedMax = config?.max_exchanges ?? DEFAULT_MAX_EXCHANGES;
  const limitsChanged = minExchanges !== savedMin || maxExchanges !== savedMax;

  async function saveConversationLimits() {
    if (!user?.id) return;
    if (invalidRange) {
      toast.error("Enter a valid range: 1-10 and min must be less than or equal to max.");
      return;
    }

    setSavingLimits(true);
    const payload = {
      account_id: user.id,
      product_name: config?.product_name ?? "our product",
      product_description: config?.product_description ?? "",
      competitors: config?.competitors ?? [],
      plans: config?.plans ?? [],
      retention_paths: config?.retention_paths ?? { offboard_gracefully: { enabled: true } },
      min_exchanges: minExchanges,
      max_exchanges: maxExchanges,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("configs")
      .upsert(payload, { onConflict: "account_id" });
    setSavingLimits(false);

    if (error) {
      toast.error("Failed to save conversation limits.");
      return;
    }

    toast.success("Conversation limits saved.");
    queryClient.invalidateQueries({ queryKey: ["config"] });
  }

  async function saveBranding() {
    if (!user?.id) return;
    setSavingBranding(true);
    const { error } = await supabase
      .from("configs")
      .upsert(
        {
          account_id: user.id,
          product_name: productName,
          widget_subtitle: widgetSubtitle,
          widget_style: widgetStyle,
          brand_primary_color: brandPrimaryColor,
          brand_button_color: brandButtonColor,
          brand_font: brandFont,
          brand_logo_url: brandLogoUrl,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "account_id" }
      );
    setSavingBranding(false);
    if (error) {
      toast.error("Failed to save branding.");
      return;
    }
    toast.success("Branding saved.");
    queryClient.invalidateQueries({ queryKey: ["config"] });
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="font-semibold text-sm text-foreground mb-1">Conversation Limits</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Set how many customer replies the interview should include before wrapping up. Choose values from 1 to 10.
        </p>

        {configLoading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Minimum customer replies before wrap-up
                </label>
                <input
                  type="number"
                  min={LIMIT_UI_MIN}
                  max={LIMIT_UI_MAX}
                  value={minExchangesInput}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") {
                      setMinExchangesInput("");
                      return;
                    }
                    if (/^\d+$/.test(raw)) {
                      setMinExchangesInput(normalizeNumericInput(raw));
                    }
                  }}
                  className={INPUT_CLS}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Guidance only: the AI may wrap earlier if the conversation is already complete.
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Maximum customer replies before wrap-up
                </label>
                <input
                  type="number"
                  min={LIMIT_UI_MIN}
                  max={LIMIT_UI_MAX}
                  value={maxExchangesInput}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") {
                      setMaxExchangesInput("");
                      return;
                    }
                    if (/^\d+$/.test(raw)) {
                      setMaxExchangesInput(normalizeNumericInput(raw));
                    }
                  }}
                  className={INPUT_CLS}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Hard cap: the interview will always wrap by this point.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={saveConversationLimits}
                disabled={savingLimits || invalidRange || !limitsChanged}
                className="px-3 py-1.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {savingLimits ? "Saving..." : "Save limits"}
              </button>
              {limitsChanged && !invalidRange && (
                <span className="text-xs text-muted-foreground">Unsaved changes</span>
              )}
              {!limitsChanged && !invalidRange && (
                <span className="text-xs text-muted-foreground">
                  Current setting: {savedMin}-{savedMax} customer replies
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="font-semibold text-sm text-foreground mb-1">Branding</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Override the brand colors, font, and logo used in the widget. These are auto-detected when you run brand analysis.
        </p>

        {configLoading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Brand name</label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="e.g. Tower"
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Widget subtitle</label>
                <input
                  type="text"
                  value={widgetSubtitle}
                  onChange={(e) => setWidgetSubtitle(e.target.value)}
                  placeholder="We'd like to hear from you"
                  className={INPUT_CLS}
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Widget style</label>
              <div className="flex gap-2">
                {([
                  { value: "chat",     label: "Chat",     hint: "Bubble-style"   },
                  { value: "survey",   label: "Survey",   hint: "Form-style"     },
                  { value: "typeform", label: "Typeform", hint: "Card animated"  },
                ] as const).map(({ value, label, hint }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setWidgetStyle(value)}
                    className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                      widgetStyle === value
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {label}
                    <span className="ml-1.5 text-xs opacity-70">{hint}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Primary color</label>
                <div className="flex items-center gap-2">
                  {brandPrimaryColor && (
                    <div
                      className="w-7 h-7 rounded border border-border shrink-0"
                      style={{ backgroundColor: brandPrimaryColor }}
                    />
                  )}
                  <input
                    type="text"
                    value={brandPrimaryColor}
                    onChange={(e) => setBrandPrimaryColor(e.target.value)}
                    placeholder="#000000"
                    className={INPUT_CLS}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Button color</label>
                <div className="flex items-center gap-2">
                  {brandButtonColor && (
                    <div
                      className="w-7 h-7 rounded border border-border shrink-0"
                      style={{ backgroundColor: brandButtonColor }}
                    />
                  )}
                  <input
                    type="text"
                    value={brandButtonColor}
                    onChange={(e) => setBrandButtonColor(e.target.value)}
                    placeholder="#000000"
                    className={INPUT_CLS}
                  />
                </div>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Font</label>
              <input
                type="text"
                value={brandFont}
                onChange={(e) => setBrandFont(e.target.value)}
                placeholder="e.g. Inter, sans-serif"
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Logo URL</label>
              <input
                type="text"
                value={brandLogoUrl}
                onChange={(e) => setBrandLogoUrl(e.target.value)}
                placeholder="https://example.com/logo.png"
                className={INPUT_CLS}
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={saveBranding}
                disabled={savingBranding}
                className="px-3 py-1.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {savingBranding ? "Saving..." : "Save branding"}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="font-semibold text-sm text-foreground mb-1">Competitors</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Define competitors and the specific questions to ask if they come up during an interview.
        </p>

        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : (
          <div className="space-y-2">
            {(competitors ?? []).map((c) => (
              <CompetitorRow key={c.id} competitor={c} />
            ))}

            {showForm ? (
              <AddCompetitorForm onCancel={() => setShowForm(false)} />
            ) : (
              <button
                onClick={() => setShowForm(true)}
                className="w-full flex items-center gap-2 px-4 py-3 border border-dashed border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add competitor
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
