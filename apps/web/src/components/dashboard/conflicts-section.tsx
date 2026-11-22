import type { DailyReportConflict, ReportEvidence } from "@callmind/shared";
import { AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

function statusVariant(status: DailyReportConflict["status"]) {
  if (status === "resolved") return "success" as const;
  if (status === "dismissed") return "secondary" as const;
  return "warning" as const;
}

export function ConflictsSection({
  conflicts,
  onViewEvidence,
}: {
  conflicts: DailyReportConflict[];
  onViewEvidence: (evidence: ReportEvidence[]) => void;
}) {
  if (conflicts.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="dashboard-conflicts-heading" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          <h2 id="dashboard-conflicts-heading" className="text-sm font-semibold">
            Conflicts
          </h2>
          <span className="text-xs text-muted-foreground">{conflicts.length}</span>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/daily-reports">Review in Daily reports</Link>
        </Button>
      </div>
      <div className="space-y-3">
        {conflicts.map((conflict) => (
          <Card key={conflict.id}>
            <CardContent className="space-y-3 p-5">
              <div className="flex flex-wrap gap-2">
                <Badge variant="warning" className="capitalize">
                  {conflict.type.replaceAll("_", " ")}
                </Badge>
                <Badge variant={statusVariant(conflict.status)}>
                  {conflict.status}
                </Badge>
              </div>
              <p className="text-sm font-medium">{conflict.summary}</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {conflict.explanation}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {conflict.values.map((value, index) => (
                  <div
                    key={`${value.insightId}-${index}`}
                    className="rounded-lg border border-border p-3"
                  >
                    <p className="text-[11px] text-muted-foreground">
                      Recording {value.recordingId.slice(-6)}
                    </p>
                    <p className="mt-1 text-sm font-medium">{value.value}</p>
                    <Button
                      variant="link"
                      size="sm"
                      className="px-0"
                      onClick={() => onViewEvidence([value.evidence])}
                    >
                      View evidence
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
