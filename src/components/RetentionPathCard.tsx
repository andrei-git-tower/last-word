import { RETENTION_META } from "@/lib/constants";

interface RetentionPathCardProps {
  path: string;
  accepted?: boolean;
  mini?: boolean;
}

export function RetentionPathCard({ path, accepted, mini }: RetentionPathCardProps) {
  const meta = RETENTION_META[path] || RETENTION_META.offboard_gracefully;

  if (mini) {
    return (
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${meta.color}`}>
        {meta.icon} {meta.label}
        {accepted ? " ✓" : ""}
      </span>
    );
  }

  return (
    <div className={`rounded-lg border p-3 ${meta.color}`}>
      <div className="flex items-center gap-2 text-sm font-semibold">
        {meta.icon} {meta.label}
      </div>
      <div className="text-xs mt-1 opacity-80">{meta.desc}</div>
    </div>
  );
}
