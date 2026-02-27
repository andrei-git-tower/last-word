import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { RuleCard } from "./RuleCard";
import { RuleEditorDialog } from "./RuleEditorDialog";
import type { Rule } from "@/types/rules";

export function RulesBuilder() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | undefined>(undefined);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const { data: rules = [], isLoading } = useQuery<Rule[]>({
    queryKey: ["rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rules")
        .select("*")
        .order("priority", { ascending: true });
      if (error) throw error;
      return data as Rule[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rules"] });
      toast.success("Rule deleted");
    },
    onError: () => toast.error("Failed to delete rule"),
  });

  const reorderMutation = useMutation({
    mutationFn: async (ordered: Rule[]) => {
      const updates = ordered.map((rule, index) =>
        supabase
          .from("rules")
          .update({ priority: index })
          .eq("id", rule.id)
          .eq("account_id", user!.id)
      );
      await Promise.all(updates);
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["rules"] });
      toast.error("Failed to save order");
    },
  });

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = rules.findIndex((r) => r.id === active.id);
    const newIndex = rules.findIndex((r) => r.id === over.id);
    const reordered = arrayMove(rules, oldIndex, newIndex);

    // Optimistic update
    queryClient.setQueryData<Rule[]>(["rules"], reordered);
    reorderMutation.mutate(reordered);
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this rule?")) return;
    deleteMutation.mutate(id);
  }

  function handleEdit(rule: Rule) {
    setEditingRule(rule);
    setEditorOpen(true);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Prompt Rules</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Rules are evaluated in priority order. The first match injects its text into the AI system prompt.
          </p>
        </div>
        <button
          onClick={() => { setEditingRule(undefined); setEditorOpen(true); }}
          className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity shrink-0"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Rule
        </button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="text-sm text-muted-foreground">Loading rules...</div>
        </div>
      ) : rules.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-center bg-card border border-dashed border-border rounded-xl">
          <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center mb-3 text-lg">⚙️</div>
          <h3 className="text-sm font-semibold text-foreground mb-1">No rules yet</h3>
          <p className="text-xs text-muted-foreground max-w-xs">
            Add a rule to inject custom text into the AI prompt based on user context like plan, MRR, or account age.
          </p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={rules.map((r) => r.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {rules.map((rule) => (
                <RuleCard
                  key={rule.id}
                  rule={rule}
                  onDelete={handleDelete}
                  onEdit={handleEdit}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <RuleEditorDialog
        open={editorOpen}
        onClose={() => { setEditorOpen(false); setEditingRule(undefined); }}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["rules"] })}
        nextPriority={rules.length}
        editingRule={editingRule}
      />
    </div>
  );
}
