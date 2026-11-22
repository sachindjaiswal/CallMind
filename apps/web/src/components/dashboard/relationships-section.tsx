import type { DailyReportRelationship, ReportEvidence } from "@callmind/shared";
import { ArrowLeftRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

function confidenceVariant(confidence: DailyReportRelationship["confidence"]) {
  if (confidence === "high") return "success" as const;
  if (confidence === "medium") return "warning" as const;
  return "outline" as const;
}

export function RelationshipsSection({
  relationships,
  onViewEvidence,
}: {
  relationships: DailyReportRelationship[];
  onViewEvidence: (evidence: ReportEvidence[]) => void;
}) {
  if (relationships.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="dashboard-relationships-heading" className="space-y-3">
      <div className="flex items-center gap-2">
        <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
        <h2 id="dashboard-relationships-heading" className="text-sm font-semibold">
          Proposed relationships
        </h2>
        <span className="text-xs text-muted-foreground">
          {relationships.length}
        </span>
      </div>
      <div className="space-y-3">
        {relationships.map((relationship) => (
          <Card key={relationship.id}>
            <CardContent className="space-y-3 p-5">
              <div className="flex flex-wrap gap-2">
                <Badge className="capitalize">
                  {relationship.type.replaceAll("_", " ")}
                </Badge>
                <Badge variant="outline">{relationship.explicitness}</Badge>
                <Badge variant={confidenceVariant(relationship.confidence)}>
                  {relationship.confidence}
                </Badge>
                <Badge variant="secondary">{relationship.reviewStatus}</Badge>
              </div>
              <p className="text-sm font-medium">{relationship.summary}</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {relationship.explanation}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onViewEvidence(relationship.evidence)}
                disabled={relationship.evidence.length === 0}
              >
                View evidence
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
