export type WorkerRuntime = "python" | "node";

export type WorkerJobKind =
  | "sales.kpi"
  | "sales.forecast"
  | "csv.process"
  | "report.pdf"
  | "csv.import"
  | "data.validate"
  | "data.transform"
  | "notification.create"
  | "email.generate";

export interface WorkerAssetRef {
  path: string;
  mediaType?: "text/csv" | "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" | "application/json" | "text/html" | "application/pdf";
}

export interface WorkerJobRequest<TParams extends Record<string, unknown> = Record<string, unknown>> {
  id: string;
  kind: WorkerJobKind;
  runtime: WorkerRuntime;
  input?: WorkerAssetRef;
  output?: WorkerAssetRef;
  params?: TParams;
  requestedAt: string;
}

export interface WorkerJobResult<TPayload = unknown> {
  id: string;
  kind: WorkerJobKind;
  runtime: WorkerRuntime;
  status: "succeeded" | "failed";
  output?: WorkerAssetRef;
  payload?: TPayload;
  error?: {
    code: string;
    message: string;
  };
  completedAt: string;
}

export interface CsvValidationIssue {
  row: number;
  column: string;
  message: string;
}

export interface CsvImportSummary {
  columns: string[];
  rowCount: number;
  previewRows: Record<string, string>[];
}

export interface NotificationDraft {
  title: string;
  body: string;
  severity: "info" | "success" | "warning" | "error";
}

export interface EmailDraft {
  to: string[];
  subject: string;
  html: string;
  text: string;
}
