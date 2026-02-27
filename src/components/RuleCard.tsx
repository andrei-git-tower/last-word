import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Rule } from "@/types/rules";

interface RuleCardProps {
  rule: Rule;
  onDelete: (id: string) => void;
}

function conditionSummary(rule: Rule): string {
  if (rule.conditions.length === 0) return "No conditions";
  const parts = rule.conditions.map(
    (c) => `${c.variable} ${c.operator} ${c.value}`
  );
  return parts.join(` ${rule.condition_logic} `);
}

export function RuleCard({ rule, onDelete }: RuleCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: rule.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-start gap-3 bg-card border border-border rounded-xl px-4 py-4 group"
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing transition-colors touch-none"
        aria-label="Drag to reorder"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="5" r="1.5" />
          <circle cx="15" cy="5" r="1.5" />
          <circle cx="9" cy="12" r="1.5" />
          <circle cx="15" cy="12" r="1.5" />
          <circle cx="9" cy="19" r="1.5" />
          <circle cx="15" cy="19" r="1.5" />
        </svg>
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold text-foreground truncate">
            {rule.name}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
            Priority {rule.priority}
          </span>
        </div>

        <p className="text-xs text-muted-foreground truncate">
          <span className="font-medium text-foreground/70">When: </span>
          {conditionSummary(rule)}
        </p>

        {rule.prompt_addition && (
          <p className="text-xs text-muted-foreground mt-1 truncate">
            <span className="font-medium text-foreground/70">Inject: </span>
            {rule.prompt_addition}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onDelete(rule.id)}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
          aria-label="Delete rule"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
            <path d="M9 6V4h6v2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
