import type { DailyReportDto } from "@callmind/shared";
import {
  AlertTriangle,
  ArrowLeftRight,
  CalendarDays,
  FileText,
  Sparkles,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";

function statusVariant(status: DailyReportDto["status"]) {
  if (status === "completed") return "success" as const;
  if (status === "failed") return "destructive" as const;
  return "warning" as const;
}

const metrics = [
  {
    key: "recordings",
    label: "Source recordings",
    icon: Users,
    value: (report: DailyReportDto) => report.sourceRecordings.length,
  },
  {
    key: "insights",
    label: "Insights",
    icon: Sparkles,
    value: (report: DailyReportDto) => report.consolidatedInsights.length,
  },
  {
    key: "relationships",
    label: "Relationships",
    icon: ArrowLeftRight,
    value: (report: DailyReportDto) => report.relationships.length,
  },
  {
    key: "conflicts",
    label: "Conflicts",
    icon: AlertTriangle,
    value: (report: DailyReportDto) => report.conflicts.length,
  },
] as const;

export function ReportSummaryCard({ report }: { report: DailyReportDto }) {
  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={statusVariant(report.status)}>{report.status}</Badge>
          <Badge variant="outline">{report.reportDate}</Badge>
          <Badge variant="outline">{report.timezone}</Badge>
          <span className="text-xs text-muted-foreground">
            {report.generatedAt
              ? `Generated ${formatDateTime(report.generatedAt)}`
              : "Not generated yet"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <CardTitle>AI-generated report summary</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {report.overallSummary ? (
          <p className="text-sm leading-relaxed">{report.overallSummary}</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {report.status === "queued" || report.status === "generating"
              ? "The report summary is being generated."
              : "No overall summary is available for this report."}
          </p>
        )}

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((metric) => (
            <div
              key={metric.key}
              className="rounded-lg border border-border bg-muted/30 p-3"
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <metric.icon className="h-3.5 w-3.5" />
                {metric.label}
              </div>
              <p className="mt-1 text-xl font-semibold tracking-tight">
                {metric.value(report)}
              </p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
          <Badge variant="outline">
            <CalendarDays className="mr-1 h-3 w-3" />
            {report.reportDate}
          </Badge>
          <Badge variant="outline">
            <FileText className="mr-1 h-3 w-3" />
            {report.sourceRecordings.length} source
            {report.sourceRecordings.length === 1 ? "" : "s"}
          </Badge>
          <Badge variant="outline">{report.provider}</Badge>
          <Badge variant="outline">{report.model}</Badge>
          <Badge variant="outline">{report.schemaVersion}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}
