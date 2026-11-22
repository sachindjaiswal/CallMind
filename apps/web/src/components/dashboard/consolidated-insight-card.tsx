import type { ConsolidatedInsight, ReportEvidence } from "@callmind/shared";
import { FileText, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function confidenceVariant(confidence: ConsolidatedInsight["confidence"]) {
  if (confidence === "high") return "success" as const;
  if (confidence === "medium") return "warning" as const;
  return "outline" as const;
}

export function ConsolidatedInsightCard({
  insight,
  onViewEvidence,
}: {
  insight: ConsolidatedInsight;
  onViewEvidence: (evidence: ReportEvidence[]) => void;
}) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="space-y-2 pb-3">
        <div className="flex flex-wrap gap-1.5">
          <Badge variant={confidenceVariant(insight.confidence)}>
            {insight.confidence} confidence
          </Badge>
          <Badge variant="outline">{insight.explicitness}</Badge>
        </div>
        <CardTitle className="text-sm leading-relaxed">
          {insight.summary}
        </CardTitle>
      </CardHeader>
      <CardContent className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-0">
        <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Users className="h-3 w-3" />
            {insight.sourceRecordingIds.length} source
            {insight.sourceRecordingIds.length === 1 ? "" : "s"}
          </span>
          <span className="inline-flex items-center gap-1">
            <FileText className="h-3 w-3" />
            {insight.evidence.length} evidence
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onViewEvidence(insight.evidence)}
          disabled={insight.evidence.length === 0}
        >
          View evidence
        </Button>
      </CardContent>
    </Card>
  );
}
