import type {
  DailyReportConflict,
  DailyReportConflictDecision,
  DailyReportDto,
  DailyReportGenerateRequest,
  DailyReportListQuery,
  DailyReportListResponse,
  RecordingConfig,
  RecordingDto,
  RecordingListResponse,
  SttLanguageHint,
  UploadFileResult,
  UploadResponse,
} from "@callmind/shared";

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
  }
}

interface ErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
  };
}

function errorMessage(
  body: unknown,
  fallbackStatus: number,
  fallbackMessage: string,
): ApiRequestError {
  const envelope = body as ErrorEnvelope | null;
  const code = envelope?.error?.code ?? "REQUEST_FAILED";
  const message =
    envelope?.error?.message ?? `${fallbackMessage} (${fallbackStatus})`;
  return new ApiRequestError(fallbackStatus, code, message);
}

async function parseResponse<T>(response: Response): Promise<T> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // A non-JSON response is handled below.
  }

  if (!response.ok) {
    throw errorMessage(body, response.status, "Request failed");
  }

  return body as T;
}

export async function fetchRecordingConfig(): Promise<RecordingConfig> {
  const response = await fetch("/api/recordings/config", {
    headers: { Accept: "application/json" },
  });
  return parseResponse<RecordingConfig>(response);
}

export async function fetchRecordings(
  params: { page?: number; limit?: number } = {},
): Promise<RecordingListResponse> {
  const searchParams = new URLSearchParams();
  if (params.page) {
    searchParams.set("page", String(params.page));
  }
  if (params.limit) {
    searchParams.set("limit", String(params.limit));
  }

  const query = searchParams.toString();
  const response = await fetch(
    `/api/recordings${query ? `?${query}` : ""}`,
    { headers: { Accept: "application/json" } },
  );
  return parseResponse<RecordingListResponse>(response);
}

export async function fetchRecording(id: string): Promise<RecordingDto> {
  const response = await fetch(`/api/recordings/${encodeURIComponent(id)}`, {
    headers: { Accept: "application/json" },
  });
  return parseResponse<RecordingDto>(response);
}

export async function retryRecording(id: string): Promise<RecordingDto> {
  const response = await fetch(`/api/recordings/${encodeURIComponent(id)}/retry`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  return parseResponse<RecordingDto>(response);
}

export async function fetchDailyReports(
  params: Partial<DailyReportListQuery> = {},
): Promise<DailyReportListResponse> {
  const searchParams = new URLSearchParams();
  if (params.reportDate) {
    searchParams.set("reportDate", params.reportDate);
  }
  if (params.status) {
    searchParams.set("status", params.status);
  }
  if (params.from) {
    searchParams.set("from", params.from);
  }
  if (params.to) {
    searchParams.set("to", params.to);
  }
  if (params.page) {
    searchParams.set("page", String(params.page));
  }
  if (params.limit) {
    searchParams.set("limit", String(params.limit));
  }

  const query = searchParams.toString();
  const response = await fetch(`/api/daily-reports${query ? `?${query}` : ""}`, {
    headers: { Accept: "application/json" },
  });
  return parseResponse<DailyReportListResponse>(response);
}

export async function fetchDailyReport(id: string): Promise<DailyReportDto> {
  const response = await fetch(
    `/api/daily-reports/${encodeURIComponent(id)}`,
    { headers: { Accept: "application/json" } },
  );
  return parseResponse<DailyReportDto>(response);
}

export async function generateDailyReport(
  request: DailyReportGenerateRequest,
): Promise<DailyReportDto> {
  const response = await fetch("/api/daily-reports", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });
  return parseResponse<DailyReportDto>(response);
}

export async function regenerateDailyReport(
  id: string,
): Promise<DailyReportDto> {
  const response = await fetch(
    `/api/daily-reports/${encodeURIComponent(id)}/regenerate`,
    {
      method: "POST",
      headers: { Accept: "application/json" },
    },
  );
  return parseResponse<DailyReportDto>(response);
}

export async function reviewDailyReportConflict(
  reportId: string,
  conflictId: string,
  decision: DailyReportConflictDecision,
): Promise<DailyReportConflict> {
  const response = await fetch(
    `/api/daily-reports/${encodeURIComponent(reportId)}/conflicts/${encodeURIComponent(conflictId)}`,
    {
      method: "PATCH",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(decision),
    },
  );
  return parseResponse<DailyReportConflict>(response);
}

export function uploadRecording(
  file: File,
  languageHint: SttLanguageHint,
  onProgress: (percentage: number) => void,
): Promise<UploadFileResult> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("files", file);
    formData.append("languageHint", languageHint);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/recordings/upload");
    xhr.responseType = "json";
    xhr.setRequestHeader("Accept", "application/json");

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      onProgress(100);
      const body = xhr.response as UploadResponse | ErrorEnvelope | null;

      if (xhr.status >= 200 && xhr.status < 300) {
        const response = body as UploadResponse | null;
        const result = response?.results?.[0];
        if (!result) {
          reject(new Error("The server returned no result for this file."));
          return;
        }
        resolve(result);
        return;
      }

      reject(errorMessage(body, xhr.status, "Upload failed"));
    };

    xhr.onerror = () => {
      reject(new ApiRequestError(0, "NETWORK_ERROR", "Network error while uploading."));
    };

    xhr.onabort = () => {
      reject(new ApiRequestError(0, "UPLOAD_ABORTED", "Upload was cancelled."));
    };

    xhr.send(formData);
  });
}
