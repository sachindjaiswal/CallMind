import type { ConsolidatedInsight, ReportEvidence } from "@callmind/shared";
import { useId } from "react";
import type { InsightCategoryGroup } from "@/lib/insight-categories";
import { ConsolidatedInsightCard } from "./consolidated-insight-card";

export function InsightCategorySection({
  group,
  onViewEvidence,
}: {
  group: InsightCategoryGroup<ConsolidatedInsight>;
  onViewEvidence: (evidence: ReportEvidence[]) => void;
}) {
  const headingId = useId();
  const Icon = group.icon;

  if (group.items.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h2 id={headingId} className="text-sm font-semibold">
          {group.label}
        </h2>
        <span className="text-xs text-muted-foreground">{group.items.length}</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {group.items.map((insight) => (
          <ConsolidatedInsightCard
            key={insight.id}
            insight={insight}
            onViewEvidence={onViewEvidence}
          />
        ))}
      </div>
    </section>
  );
}
