// @vitest-environment jsdom
import {
  getDateInTimeZone,
  type ConversationInsight,
  type DailyReportDto,
  type RecordingDto,
  type ReportEvidence,
  type TranscriptDto,
} from "@callmind/shared";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchDailyReport, fetchDailyReports, fetchRecording } from "@/lib/api";
import DashboardPage from "./dashboard";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    fetchDailyReports: vi.fn(),
    fetchDailyReport: vi.fn(),
    fetchRecording: vi.fn(),
  };
});

const evidence: ReportEvidence = {
  insightId: "analysis-recording-1:insight:0",
  analysisId: "analysis-recording-1",
  recordingId: "recording-1",
  segmentId: "segment-1",
  segmentIndex: 1,
  start: 4,
  end: 9,
  quote: "Ship the dashboard on Friday.",
};

const baseInsight: ConversationInsight = {
  category: "insight",
  explicitness: "explicit",
  confidence: "high",
  summary: "A complete source quote.",
  speakerId: null,
  evidence: {
    recordingId: "recording-1",
    segmentId: "segment-1",
    segmentIndex: 1,
    start: 4,
    end: 9,
    quote: "A complete source quote.",
  },
  name: null,
  role: null,
  contactInfo: null,
  description: null,
  assignedBy: null,
  assignedTo: null,
  taskDirection: null,
  deadlineOriginal: null,
  dueDate: null,
  status: null,
  originalExpression: null,
  normalizedDate: null,
  dateType: null,
  referenceDate: null,
  participants: [],
  madeBy: null,
  concerns: null,
  productOrService: null,
  quantity: null,
  quantityUnit: null,
  amount: null,
  currency: null,
  paymentStatus: null,
  deliveryStatus: null,
  deliveryDestination: null,
  deliveryDate: null,
  deliveryTime: null,
  packagingRequirements: null,
  milestone: null,
  severity: null,
  question: null,
  askedBy: null,
  relatedPeople: [],
  relatedProjects: [],
};

function firstInsights(): ConversationInsight[] {
  return [
    {
      ...baseInsight,
      category: "task",
      summary: "Ship the dashboard on Friday.",
      assignedTo: "Maya",
      taskDirection: "assigned_by_uploader",
      dueDate: "Friday",
      status: "pending",
      description: "Dashboard release",
    },
    {
      ...baseInsight,
      category: "person",
      summary: "Maya owns the dashboard review.",
      explicitness: "inferred",
      confidence: "medium",
      name: "Maya",
      role: "Reviewer",
      relatedPeople: ["Maya"],
      evidence: {
        ...baseInsight.evidence,
        quote: "Maya will review the dashboard.",
      },
    },
    {
      ...baseInsight,
      category: "risk",
      summary: "Vendor pricing remains unclear.",
      confidence: "low",
      severity: "medium",
      concerns: "Budget approval is pending.",
      evidence: {
        ...baseInsight.evidence,
        quote: "Vendor pricing remains unclear.",
      },
    },
  ];
}

function secondInsights(): ConversationInsight[] {
  return [
    {
      ...baseInsight,
      category: "transaction",
      summary: "The vendor quoted 50 units at 12 USD each.",
      evidence: {
        ...baseInsight.evidence,
        recordingId: "recording-2",
        segmentId: "segment-2",
        quote: "The vendor quoted 50 units at 12 USD each.",
      },
      productOrService: "Widgets",
      quantity: 50,
      amount: 12,
      currency: "USD",
      paymentStatus: "not_paid",
    },
  ];
}

function transcriptDto(language: string): TranscriptDto {
  return {
    id: `transcript-language-${language}`,
    text: "A short transcript.",
    language,
    durationSeconds: 30,
    provider: "groq",
    model: "whisper-large-v3-turbo",
    processedAt: "2026-11-21T10:01:00.000Z",
    segments: [],
  };
}

function recordingDto(options: {
  id: string;
  filename: string;
  summary: string;
  insights: ConversationInsight[];
  topics?: string[];
  languageHint?: RecordingDto["languageHint"];
  transcriptLanguage?: string | null;
}): RecordingDto {
  return {
    id: options.id,
    originalFilename: options.filename,
    mimeType: "audio/wav",
    extension: "wav",
    sizeBytes: 1024,
    checksum: `checksum-${options.id}`,
    status: "analysis_completed",
    languageHint: options.languageHint === undefined ? "en" : options.languageHint,
    progress: 100,
    durationSeconds: 780,
    metadata: null,
    error: null,
    attempts: 1,
    transcriptionAttempts: 1,
    createdAt: "2026-11-21T10:00:00.000Z",
    updatedAt: "2026-11-21T10:05:00.000Z",
    preparedAt: "2026-11-21T10:01:00.000Z",
    transcript: options.transcriptLanguage
      ? transcriptDto(options.transcriptLanguage)
      : null,
    analysis: {
      id: `analysis-${options.id}`,
      recordingId: options.id,
      transcriptId: `transcript-${options.id}`,
      status: "completed",
      provider: "gemini",
      model: "gemini-3.1-flash-lite",
      fallbackUsed: false,
      attemptedModels: [],
      schemaVersion: "conversation-insights-v1",
      promptVersion: "conversation-analysis-v1",
      summary: options.summary,
      topics: options.topics ?? [],
      insights: options.insights,
      error: null,
      analyzedAt: "2026-11-21T10:05:00.000Z",
      attempts: 1,
      createdAt: "2026-11-21T10:02:00.000Z",
      updatedAt: "2026-11-21T10:05:00.000Z",
    },
  };
}

function firstRecording(): RecordingDto {
  return recordingDto({
    id: "recording-1",
    filename: "maya-dashboard-call.wav",
    summary:
      "The team reviewed the dashboard plan. Maya agreed to own the review. The launch date is Friday. Vendor pricing remains unresolved.",
    insights: firstInsights(),
    topics: ["dashboard", "review", "pricing"],
  });
}

function completedReport(): DailyReportDto {
  return {
    id: "report-1",
    workspaceId: "default",
    reportDate: "2026-11-21",
    timezone: "UTC",
    status: "completed",
    selectedRecordingIds: ["recording-1"],
    sourceRecordings: [
      {
        recordingId: "recording-1",
        transcriptId: "transcript-recording-1",
        analysisId: "analysis-recording-1",
        createdAt: "2026-11-21T10:00:00.000Z",
        analyzedAt: "2026-11-21T10:05:00.000Z",
      },
    ],
    sourceAnalysisIds: ["analysis-recording-1"],
    overallSummary: "The team agreed on the dashboard scope.",
    consolidatedInsights: [
      {
        id: "insight-task",
        category: "task",
        summary: "Ship the dashboard on Friday.",
        explicitness: "explicit",
        confidence: "high",
        sourceInsightIds: ["analysis-recording-1:insight:0"],
        sourceRecordingIds: ["recording-1"],
        evidence: [evidence],
      },
      {
        id: "insight-person",
        category: "person",
        summary: "Maya owns the dashboard review.",
        explicitness: "inferred",
        confidence: "medium",
        sourceInsightIds: ["analysis-recording-1:insight:1"],
        sourceRecordingIds: ["recording-1"],
        evidence: [{ ...evidence, insightId: "analysis-recording-1:insight:1" }],
      },
    ],
    relationships: [
      {
        id: "relationship-1",
        type: "shared_topic",
        summary: "Both insights concern the dashboard.",
        explanation: "The same dashboard work is referenced.",
        explicitness: "inferred",
        confidence: "medium",
        sourceInsightIds: [
          "analysis-recording-1:insight:0",
          "analysis-recording-1:insight:1",
        ],
        sourceRecordingIds: ["recording-1"],
        evidence: [evidence],
        reviewStatus: "pending",
      },
    ],
    conflicts: [
      {
        id: "conflict-1",
        type: "date_conflict",
        summary: "The deadline differs.",
        explanation: "Two dates were mentioned.",
        explicitness: "explicit",
        confidence: "high",
        sourceInsightIds: ["analysis-recording-1:insight:0"],
        sourceRecordingIds: ["recording-1"],
        values: [
          {
            value: "Friday",
            insightId: "analysis-recording-1:insight:0",
            recordingId: "recording-1",
            evidence,
          },
          {
            value: "Monday",
            insightId: "analysis-recording-1:insight:2",
            recordingId: "recording-1",
            evidence: {
              ...evidence,
              insightId: "analysis-recording-1:insight:2",
            },
          },
        ],
        status: "unresolved",
        reviewerNote: null,
        reviewedAt: null,
      },
    ],
    provider: "system",
    model: "deterministic-v1",
    schemaVersion: "daily-report-v1",
    generationVersion: "deterministic-v1",
    requestFingerprint: "fingerprint",
    previousReportId: null,
    attempts: 1,
    error: null,
    generatedAt: "2026-11-21T10:10:00.000Z",
    createdAt: "2026-11-21T10:00:00.000Z",
    updatedAt: "2026-11-21T10:10:00.000Z",
  };
}

function LocationDisplay() {
  const location = useLocation();
  return (
    <div data-testid="location">
      {location.pathname}
      {location.search}
    </div>
  );
}

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/recordings" element={<LocationDisplay />} />
      </Routes>
    </MemoryRouter>,
  );
}

function reportList(items: DailyReportDto[]) {
  return {
    items,
    page: 1,
    limit: 100,
    total: items.length,
    totalPages: 1,
  };
}

function mockReports(reports: DailyReportDto[]): void {
  vi.mocked(fetchDailyReports).mockResolvedValue(reportList(reports));
}

function mockReportsForDates(
  reportsByDate: Record<string, DailyReportDto[]>,
  fallbackReports: DailyReportDto[] = [],
): void {
  vi.mocked(fetchDailyReports).mockImplementation(async (params) => {
    if (!params?.reportDate) {
      return reportList(fallbackReports);
    }
    return reportList(reportsByDate[params.reportDate] ?? []);
  });
}

function browserReportDate(): string {
  const timezone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  return getDateInTimeZone(new Date(), timezone);
}

beforeEach(() => {
  vi.mocked(fetchDailyReports).mockReset();
  vi.mocked(fetchDailyReport).mockReset();
  vi.mocked(fetchRecording).mockReset();
  vi.mocked(fetchRecording).mockRejectedValue(
    new Error("Recording details unavailable"),
  );
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("dashboard", () => {
  it("renders one rich recording card with bullet summary and evidence navigation", async () => {
    mockReports([completedReport()]);
    vi.mocked(fetchRecording).mockImplementation(async (id) => {
      if (id === "recording-1") {
        return firstRecording();
      }
      throw new Error("Unknown recording");
    });

    renderDashboard();

    expect(await screen.findByText("maya-dashboard-call.wav")).toBeTruthy();
    expect(screen.getAllByTestId("recording-card")).toHaveLength(1);
    expect(screen.getByText("AI-generated report summary")).toBeTruthy();
    expect(screen.getByText("Call summary")).toBeTruthy();
    expect(screen.getByText("Maya agreed to own the review.")).toBeTruthy();
    expect(screen.getByText("Vendor pricing remains unresolved.")).toBeTruthy();
    expect(screen.getByText("Tasks and responsibilities")).toBeTruthy();
    expect(screen.getByText("People and organizations")).toBeTruthy();
    expect(screen.getByText("Risks, concerns, and questions")).toBeTruthy();
    expect(screen.queryByText("Dates, quantities, and prices")).toBeNull();
    const taskSection = screen.getByRole("region", {
      name: "Tasks and responsibilities",
    });
    expect(
      within(taskSection).getByText(/Assigned to/).parentElement?.textContent,
    ).toContain("Maya");
    expect(
      within(taskSection).getByText(/Due date/).parentElement?.textContent,
    ).toContain("Friday");
    expect(screen.getByText("Proposed relationships")).toBeTruthy();

    fireEvent.click(
      screen.getAllByRole("button", { name: /view evidence/i })[0],
    );
    fireEvent.click(
      screen.getAllByRole("button", { name: /open source recording/i })[0],
    );

    const location = await screen.findByTestId("location");
    const params = new URLSearchParams(location.textContent?.split("?")[1] ?? "");
    expect(location.textContent).toContain("/recordings");
    expect(params.get("recordingId")).toBe("recording-1");
    expect(params.get("segmentId")).toBe("segment-1");
    expect(params.get("segmentIndex")).toBe("1");
    expect(params.get("start")).toBe("4");
  });

  it("keeps multiple source recordings in separate cards", async () => {
    const report = completedReport();
    report.selectedRecordingIds.push("recording-2");
    report.sourceRecordings.push({
      recordingId: "recording-2",
      transcriptId: "transcript-recording-2",
      analysisId: "analysis-recording-2",
      createdAt: "2026-11-21T11:00:00.000Z",
      analyzedAt: "2026-11-21T11:05:00.000Z",
    });
    mockReports([report]);
    vi.mocked(fetchRecording).mockImplementation(async (id) => {
      if (id === "recording-1") {
        return firstRecording();
      }
      if (id === "recording-2") {
        return recordingDto({
          id: "recording-2",
          filename: "pricing-call.wav",
          summary: "The vendor discussed pricing for the next order.",
          insights: secondInsights(),
          topics: ["pricing"],
        });
      }
      throw new Error("Unknown recording");
    });

    renderDashboard();

    expect(await screen.findByText("maya-dashboard-call.wav")).toBeTruthy();
    expect(await screen.findByText("pricing-call.wav")).toBeTruthy();
    expect(screen.getAllByTestId("recording-card")).toHaveLength(2);
    const [firstCard, secondCard] = screen.getAllByTestId("recording-card");
    expect(within(firstCard).getByText("maya-dashboard-call.wav")).toBeTruthy();
    expect(within(secondCard).getByText("pricing-call.wav")).toBeTruthy();
    expect(within(firstCard).getByText("Tasks and responsibilities")).toBeTruthy();
    expect(
      within(secondCard).getByText("Dates, quantities, and prices"),
    ).toBeTruthy();
    expect(
      within(secondCard).getByText(/Quantity/).parentElement?.textContent,
    ).toContain("50");
    expect(
      within(secondCard).getByText(/Amount/).parentElement?.textContent,
    ).toContain("USD 12");
    expect(within(firstCard).queryByText("pricing-call.wav")).toBeNull();
    expect(within(secondCard).queryByText("maya-dashboard-call.wav")).toBeNull();
  });

  it("omits empty detail sections", async () => {
    mockReports([completedReport()]);
    vi.mocked(fetchRecording).mockResolvedValue(
      recordingDto({
        id: "recording-1",
        filename: "task-only.wav",
        summary: "The team assigned one task.",
        insights: [firstInsights()[0]],
      }),
    );

    renderDashboard();

    expect(await screen.findByText("task-only.wav")).toBeTruthy();
    expect(screen.getByText("Tasks and responsibilities")).toBeTruthy();
    expect(screen.queryByText("People and organizations")).toBeNull();
    expect(screen.queryByText("Decisions and agreements")).toBeNull();
    expect(screen.queryByText("Risks, concerns, and questions")).toBeNull();
  });

  it("falls back to consolidated report insights when recording details fail", async () => {
    mockReports([completedReport()]);

    renderDashboard();

    expect(
      await screen.findByText(/Full per-recording analysis is unavailable/i),
    ).toBeTruthy();
    expect(screen.getByText("Ship the dashboard on Friday.")).toBeTruthy();
    expect(screen.getByText("Tasks and responsibilities")).toBeTruthy();
  });

  it("keeps timezone and version selection functional", async () => {
    const utcOld = {
      ...completedReport(),
      id: "report-utc-old",
      createdAt: "2026-11-21T09:00:00.000Z",
      overallSummary: "Older UTC summary.",
    };
    const utcNew = {
      ...completedReport(),
      id: "report-utc-new",
      createdAt: "2026-11-21T10:00:00.000Z",
      overallSummary: "Newer UTC summary.",
    };
    const tokyo = {
      ...completedReport(),
      id: "report-tokyo",
      timezone: "Asia/Tokyo",
      createdAt: "2026-11-21T11:00:00.000Z",
      overallSummary: "Tokyo summary.",
    };
    mockReports([utcOld, utcNew, tokyo]);
    vi.mocked(fetchRecording).mockImplementation(async () => firstRecording());

    renderDashboard();

    expect(await screen.findByText("Tokyo summary.")).toBeTruthy();
    const timezone = screen.getByLabelText("Timezone") as HTMLSelectElement;
    expect(timezone.value).toBe("Asia/Tokyo");
    expect(screen.queryByLabelText("Report version")).toBeNull();

    fireEvent.change(timezone, { target: { value: "UTC" } });
    expect(await screen.findByText("Newer UTC summary.")).toBeTruthy();

    const version = screen.getByLabelText("Report version") as HTMLSelectElement;
    expect(version.value).toBe("report-utc-new");
    fireEvent.change(version, { target: { value: "report-utc-old" } });
    expect(await screen.findByText("Older UTC summary.")).toBeTruthy();
    expect(
      vi.mocked(fetchDailyReports).mock.calls.some(([params]) => !params?.reportDate),
    ).toBe(false);
  });

  it("renders the no-report state for an empty date", async () => {
    mockReports([]);

    renderDashboard();

    expect(
      await screen.findByText("No daily report for this date"),
    ).toBeTruthy();
  });

  it("renders the API error state", async () => {
    vi.mocked(fetchDailyReports).mockRejectedValue(
      new Error("Network unavailable"),
    );

    renderDashboard();

    expect(
      await screen.findByText("Could not load the dashboard"),
    ).toBeTruthy();
    expect(screen.getByText("Network unavailable")).toBeTruthy();
  });

  it("selects today's completed report when available", async () => {
    const today = browserReportDate();
    const todayReport: DailyReportDto = {
      ...completedReport(),
      id: "today-report",
      reportDate: today,
      overallSummary: "Today summary.",
      createdAt: "2026-11-22T10:00:00.000Z",
    };
    const olderReport: DailyReportDto = {
      ...completedReport(),
      id: "older-report",
      reportDate: "2000-01-01",
      overallSummary: "Older fallback summary.",
      createdAt: "2000-01-01T10:00:00.000Z",
    };
    mockReportsForDates(
      { [today]: [todayReport], [olderReport.reportDate]: [olderReport] },
      [olderReport],
    );

    renderDashboard();

    expect(await screen.findByText("Today summary.")).toBeTruthy();
    expect(screen.queryByText("Older fallback summary.")).toBeNull();
    expect((screen.getByLabelText("Reporting date") as HTMLInputElement).value).toBe(
      today,
    );
    expect(
      vi.mocked(fetchDailyReports).mock.calls.some(([params]) => !params?.reportDate),
    ).toBe(false);
  });

  it("falls back to the latest completed report when today has none", async () => {
    const today = browserReportDate();
    const failedToday: DailyReportDto = {
      ...completedReport(),
      id: "failed-today",
      reportDate: today,
      status: "failed",
      overallSummary: "Failed today summary.",
      createdAt: "2026-11-22T10:00:00.000Z",
    };
    const olderReport: DailyReportDto = {
      ...completedReport(),
      id: "older-report",
      reportDate: "2000-01-01",
      overallSummary: "Older completed summary.",
      createdAt: "2000-01-01T10:00:00.000Z",
    };
    mockReportsForDates(
      { [today]: [failedToday], [olderReport.reportDate]: [olderReport] },
      [olderReport],
    );

    renderDashboard();

    expect(await screen.findByText("Older completed summary.")).toBeTruthy();
    expect(screen.queryByText("Failed today summary.")).toBeNull();
    expect((screen.getByLabelText("Reporting date") as HTMLInputElement).value).toBe(
      olderReport.reportDate,
    );
  });

  it("preserves an explicitly selected historical date without fallback", async () => {
    const today = browserReportDate();
    const todayReport: DailyReportDto = {
      ...completedReport(),
      id: "today-report",
      reportDate: today,
      overallSummary: "Today summary.",
      createdAt: "2026-11-22T10:00:00.000Z",
    };
    const olderReport: DailyReportDto = {
      ...completedReport(),
      id: "older-report",
      reportDate: "2000-01-01",
      overallSummary: "Older fallback summary.",
      createdAt: "2000-01-01T10:00:00.000Z",
    };
    mockReportsForDates(
      { [today]: [todayReport], [olderReport.reportDate]: [olderReport] },
      [olderReport],
    );

    renderDashboard();

    expect(await screen.findByText("Today summary.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Reporting date"), {
      target: { value: "1999-01-01" },
    });

    expect(
      await screen.findByText("No daily report for this date"),
    ).toBeTruthy();
    expect(screen.queryByText("Older fallback summary.")).toBeNull();
    expect(
      vi.mocked(fetchDailyReports).mock.calls.some(([params]) => !params?.reportDate),
    ).toBe(false);
  });

  it("prefers detected transcript language over a conflicting hint", async () => {
    mockReports([completedReport()]);
    const recording = firstRecording();
    recording.transcript = transcriptDto("Hindi");
    vi.mocked(fetchRecording).mockResolvedValue(recording);

    renderDashboard();

    expect(await screen.findByText("maya-dashboard-call.wav")).toBeTruthy();
    expect(screen.getByText(/Language:/).parentElement?.textContent).toContain(
      "Hindi",
    );
    expect(screen.queryByText(/Language hint:/)).toBeNull();
  });

  it("uses the language hint when transcript language is unavailable", async () => {
    mockReports([completedReport()]);
    vi.mocked(fetchRecording).mockResolvedValue(firstRecording());

    renderDashboard();

    expect(await screen.findByText("maya-dashboard-call.wav")).toBeTruthy();
    expect(
      screen.getByText(/Language hint:/).parentElement?.textContent,
    ).toContain("en");
  });

  it("hides language metadata when neither detected language nor hint exists", async () => {
    mockReports([completedReport()]);
    vi.mocked(fetchRecording).mockResolvedValue(
      recordingDto({
        id: "recording-1",
        filename: "no-language.wav",
        summary: "The team reviewed the dashboard plan.",
        insights: firstInsights(),
        languageHint: "" as RecordingDto["languageHint"],
      }),
    );

    renderDashboard();

    expect(await screen.findByText("no-language.wav")).toBeTruthy();
    expect(screen.queryByText(/Language:/)).toBeNull();
    expect(screen.queryByText(/Language hint:/)).toBeNull();
    expect(screen.getAllByTestId("recording-card")).toHaveLength(1);
  });

  it("displays an inferred contact near the recording title", async () => {
    mockReports([completedReport()]);
    vi.mocked(fetchRecording).mockResolvedValue(
      recordingDto({
        id: "recording-1",
        filename: "Rahul Sharma.mp3",
        summary: "The team reviewed the dashboard plan.",
        insights: firstInsights(),
      }),
    );

    renderDashboard();

    expect(await screen.findByText("Rahul Sharma.mp3")).toBeTruthy();
    expect(screen.getByText("Likely contact (from filename)")).toBeTruthy();
    expect(screen.getByText("Rahul Sharma")).toBeTruthy();
  });

  it("does not display an inferred contact for a generic or numeric filename", async () => {
    mockReports([completedReport()]);
    vi.mocked(fetchRecording).mockResolvedValue(
      recordingDto({
        id: "recording-1",
        filename: "Recording_001.mp3",
        summary: "The team reviewed the dashboard plan.",
        insights: firstInsights(),
      }),
    );

    renderDashboard();

    expect(await screen.findByText("Recording_001.mp3")).toBeTruthy();
    expect(screen.queryByText("Likely contact (from filename)")).toBeNull();
  });

  it("uses the recording identifier fallback when the filename is unavailable", async () => {
    mockReports([completedReport()]);
    vi.mocked(fetchRecording).mockResolvedValue(
      recordingDto({
        id: "recording-1",
        filename: "",
        summary: "The team reviewed the dashboard plan.",
        insights: firstInsights(),
      }),
    );

    renderDashboard();

    expect((await screen.findAllByText("Recording ding-1")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Likely contact (from filename)")).toBeNull();
  });

  it("infers contacts independently for multiple recording cards", async () => {
    const report = completedReport();
    report.selectedRecordingIds.push("recording-2");
    report.sourceRecordings.push({
      recordingId: "recording-2",
      transcriptId: "transcript-recording-2",
      analysisId: "analysis-recording-2",
      createdAt: "2026-11-21T11:00:00.000Z",
      analyzedAt: "2026-11-21T11:05:00.000Z",
    });
    mockReports([report]);
    vi.mocked(fetchRecording).mockImplementation(async (id) => {
      if (id === "recording-1") {
        return recordingDto({
          id: "recording-1",
          filename: "Rahul Sharma.mp3",
          summary: "The team reviewed the dashboard plan.",
          insights: firstInsights(),
        });
      }
      if (id === "recording-2") {
        return recordingDto({
          id: "recording-2",
          filename: "Call with Priya.m4a",
          summary: "The vendor discussed pricing for the next order.",
          insights: secondInsights(),
        });
      }
      throw new Error("Unknown recording");
    });

    renderDashboard();

    const [firstCard, secondCard] = await screen.findAllByTestId(
      "recording-card",
    );
    expect(within(firstCard).getByText("Rahul Sharma.mp3")).toBeTruthy();
    expect(within(firstCard).getByText("Rahul Sharma")).toBeTruthy();
    expect(within(firstCard).queryByText("Priya")).toBeNull();
    expect(within(secondCard).getByText("Call with Priya.m4a")).toBeTruthy();
    expect(within(secondCard).getByText("Priya")).toBeTruthy();
    expect(within(secondCard).queryByText("Rahul Sharma")).toBeNull();
    expect(
      within(firstCard).getByText("Likely contact (from filename)"),
    ).toBeTruthy();
    expect(
      within(secondCard).getByText("Likely contact (from filename)"),
    ).toBeTruthy();
  });

  it("keeps evidence navigation functional when an inferred contact is displayed", async () => {
    mockReports([completedReport()]);
    const recording = firstRecording();
    recording.originalFilename = "Call with Priya.m4a";
    vi.mocked(fetchRecording).mockResolvedValue(recording);

    renderDashboard();

    expect(await screen.findByText("Priya")).toBeTruthy();
    expect(screen.getByText("Likely contact (from filename)")).toBeTruthy();

    fireEvent.click(
      screen.getAllByRole("button", { name: /view evidence/i })[0],
    );
    fireEvent.click(
      screen.getAllByRole("button", { name: /open source recording/i })[0],
    );

    const location = await screen.findByTestId("location");
    const params = new URLSearchParams(location.textContent?.split("?")[1] ?? "");
    expect(location.textContent).toContain("/recordings");
    expect(params.get("recordingId")).toBe("recording-1");
    expect(params.get("segmentId")).toBe("segment-1");
    expect(params.get("segmentIndex")).toBe("1");
    expect(params.get("start")).toBe("4");
  });
});
