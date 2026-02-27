import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import type { Condition, Operator, RuleVariable } from "@/types/rules";

const VARIABLES: { value: RuleVariable; label: string }[] = [
  { value: "plan", label: "Plan" },
  { value: "account_age", label: "Account Age (days)" },
  { value: "seats", label: "Seats" },
  { value: "mrr", label: "MRR" },
  { value: "email", label: "Email" },
];

const NUMERIC_VARS: RuleVariable[] = ["account_age", "seats", "mrr"];

const OPERATORS_FOR: Record<string, { value: Operator; label: string }[]> = {
  numeric: [
    { value: "==", label: "=" },
    { value: "!=", label: "≠" },
    { value: ">", label: ">" },
    { value: "<", label: "<" },
    { value: ">=", label: "≥" },
    { value: "<=", label: "≤" },
  ],
  string: [
    { value: "==", label: "=" },
    { value: "!=", label: "≠" },
    { value: "contains", label: "contains" },
  ],
};

function getOperators(variable: RuleVariable) {
  return NUMERIC_VARS.includes(variable)
    ? OPERATORS_FOR.numeric
    : OPERATORS_FOR.string;
}

const emptyCondition = (): Condition => ({
  variable: "plan",
  operator: "==",
  value: "",
});

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  nextPriority: number;
  editingRule?: import("@/types/rules").Rule;
}

export function RuleEditorDialog({ open, onClose, onSaved, nextPriority, editingRule }: Props) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [conditionLogic, setConditionLogic] = useState<"AND" | "OR">("AND");
  const [conditions, setConditions] = useState<Condition[]>([emptyCondition()]);
  const [promptAddition, setPromptAddition] = useState("");

  // Populate fields when opening for edit
  useEffect(() => {
    if (open && editingRule) {
      setName(editingRule.name);
      setConditionLogic(editingRule.condition_logic);
      setConditions(editingRule.conditions);
      setPromptAddition(editingRule.prompt_addition ?? "");
    } else if (open && !editingRule) {
      setName("");
      setConditionLogic("AND");
      setConditions([emptyCondition()]);
      setPromptAddition("");
    }
  }, [open, editingRule]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingRule) {
        const { error } = await supabase
          .from("rules")
          .update({
            name: name.trim(),
            condition_logic: conditionLogic,
            conditions: conditions as unknown as import("@/integrations/supabase/types").Json,
            prompt_addition: promptAddition.trim(),
          })
          .eq("id", editingRule.id)
          .eq("account_id", user!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("rules").insert({
          account_id: user!.id,
          name: name.trim(),
          priority: nextPriority,
          condition_logic: conditionLogic,
          conditions: conditions as unknown as import("@/integrations/supabase/types").Json,
          prompt_addition: promptAddition.trim(),
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingRule ? "Rule updated" : "Rule saved");
      onSaved();
      handleClose();
    },
    onError: () => toast.error(editingRule ? "Failed to update rule" : "Failed to save rule"),
  });

  function handleClose() {
    setName("");
    setConditionLogic("AND");
    setConditions([emptyCondition()]);
    setPromptAddition("");
    onClose();
  }

  function updateCondition(index: number, patch: Partial<Condition>) {
    setConditions((prev) => {
      const next = [...prev];
      const updated = { ...next[index], ...patch };
      // Reset operator when variable changes
      if ("variable" in patch) {
        const ops = getOperators(patch.variable as RuleVariable);
        updated.operator = ops[0].value;
        updated.value = "";
      }
      next[index] = updated;
      return next;
    });
  }

  function addCondition() {
    setConditions((prev) => [...prev, emptyCondition()]);
  }

  function removeCondition(index: number) {
    setConditions((prev) => prev.filter((_, i) => i !== index));
  }

  if (!open) return null;

  const canSave =
    name.trim().length > 0 &&
    conditions.length > 0 &&
    conditions.every((c) => String(c.value).trim().length > 0) &&
    promptAddition.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card rounded-2xl border border-border shadow-xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border shrink-0">
          <h2 className="text-base font-semibold text-foreground">{editingRule ? "Edit Rule" : "New Rule"}</h2>
          <button
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {/* Name */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1.5">
              Rule name
            </label>
            <input
              type="text"
              placeholder="e.g. Enterprise churners"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-sm bg-secondary border border-border rounded-lg px-3 py-2.5 text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
            />
          </div>

          {/* Conditions */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Conditions
              </label>
              {conditions.length > 1 && (
                <div className="flex items-center gap-1">
                  {(["AND", "OR"] as const).map((logic) => (
                    <button
                      key={logic}
                      onClick={() => setConditionLogic(logic)}
                      className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                        conditionLogic === logic
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {logic}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              {conditions.map((cond, i) => {
                const ops = getOperators(cond.variable);
                const isNumeric = NUMERIC_VARS.includes(cond.variable);
                return (
                  <div key={i} className="flex items-center gap-2">
                    {/* Variable */}
                    <select
                      value={cond.variable}
                      onChange={(e) =>
                        updateCondition(i, { variable: e.target.value as RuleVariable })
                      }
                      className="flex-1 text-sm bg-secondary border border-border rounded-lg px-2.5 py-2 text-foreground outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
                    >
                      {VARIABLES.map((v) => (
                        <option key={v.value} value={v.value}>
                          {v.label}
                        </option>
                      ))}
                    </select>

                    {/* Operator */}
                    <select
                      value={cond.operator}
                      onChange={(e) =>
                        updateCondition(i, { operator: e.target.value as Operator })
                      }
                      className="w-24 text-sm bg-secondary border border-border rounded-lg px-2.5 py-2 text-foreground outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
                    >
                      {ops.map((op) => (
                        <option key={op.value} value={op.value}>
                          {op.label}
                        </option>
                      ))}
                    </select>

                    {/* Value */}
                    <input
                      type={isNumeric ? "number" : "text"}
                      placeholder="value"
                      value={cond.value}
                      onChange={(e) =>
                        updateCondition(i, {
                          value: isNumeric ? Number(e.target.value) : e.target.value,
                        })
                      }
                      className="flex-1 text-sm bg-secondary border border-border rounded-lg px-2.5 py-2 text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
                    />

                    {/* Remove */}
                    {conditions.length > 1 && (
                      <button
                        onClick={() => removeCondition(i)}
                        className="shrink-0 text-muted-foreground hover:text-red-500 transition-colors p-1"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              onClick={addCondition}
              className="mt-2 text-xs text-primary hover:text-primary/80 font-medium transition-colors flex items-center gap-1"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add condition
            </button>
          </div>

          {/* Prompt addition */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1.5">
              Text to inject into prompt
            </label>
            <textarea
              rows={4}
              placeholder="e.g. This user is on the Enterprise plan. Emphasize data security and compliance features. Offer a dedicated CSM call."
              value={promptAddition}
              onChange={(e) => setPromptAddition(e.target.value)}
              className="w-full text-sm bg-secondary border border-border rounded-lg px-3 py-2.5 text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border shrink-0">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={!canSave || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saveMutation.isPending ? "Saving…" : editingRule ? "Update rule" : "Save rule"}
          </button>
        </div>
      </div>
    </div>
  );
}
