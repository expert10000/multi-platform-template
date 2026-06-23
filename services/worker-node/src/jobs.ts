import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CsvImportSummary, CsvValidationIssue, EmailDraft, NotificationDraft, WorkerJobRequest, WorkerJobResult } from "@enterprise-analytics/worker-api-contract";
import { readCsvPreview } from "./csv.js";

export async function runNodeWorkerJob(request: WorkerJobRequest): Promise<WorkerJobResult> {
  try {
    const payload = await runJobPayload(request);
    if (request.output?.path) {
      await writeJson(request.output.path, payload);
    }

    return {
      id: request.id,
      kind: request.kind,
      runtime: "node",
      status: "succeeded",
      output: request.output,
      payload,
      completedAt: new Date().toISOString()
    };
  } catch (error) {
    return {
      id: request.id,
      kind: request.kind,
      runtime: "node",
      status: "failed",
      error: {
        code: "NODE_WORKER_JOB_FAILED",
        message: error instanceof Error ? error.message : String(error)
      },
      completedAt: new Date().toISOString()
    };
  }
}

async function runJobPayload(request: WorkerJobRequest) {
  switch (request.kind) {
    case "csv.import":
      return importCsv(request);
    case "data.validate":
      return validateData(request);
    case "data.transform":
      return transformData(request);
    case "notification.create":
      return createNotification(request);
    case "email.generate":
      return generateEmail(request);
    default:
      throw new Error(`Node worker does not support job kind: ${request.kind}`);
  }
}

async function importCsv(request: WorkerJobRequest): Promise<CsvImportSummary> {
  const inputPath = requireInputPath(request);
  return readCsvPreview(inputPath, { maxPreviewRows: Number(request.params?.previewRows ?? 5) });
}

async function validateData(request: WorkerJobRequest): Promise<{ valid: boolean; issues: CsvValidationIssue[]; summary: CsvImportSummary }> {
  const inputPath = requireInputPath(request);
  const requiredColumns = Array.isArray(request.params?.requiredColumns) ? request.params.requiredColumns.map(String) : [];
  const summary = await readCsvPreview(inputPath);
  const missingColumns = requiredColumns.filter((column) => !summary.columns.includes(column));
  const issues = missingColumns.map((column) => ({
    row: 0,
    column,
    message: `Missing required column: ${column}`
  }));

  return {
    valid: issues.length === 0,
    issues,
    summary
  };
}

async function transformData(request: WorkerJobRequest): Promise<{ columns: string[]; rowCount: number; transform: string }> {
  const inputPath = requireInputPath(request);
  const summary = await readCsvPreview(inputPath);
  const transform = String(request.params?.transform ?? "trim-preview");

  return {
    columns: summary.columns,
    rowCount: summary.rowCount,
    transform
  };
}

function createNotification(request: WorkerJobRequest): NotificationDraft {
  return {
    title: String(request.params?.title ?? "Workspace job completed"),
    body: String(request.params?.body ?? "A worker job finished and is ready for review."),
    severity: normalizeSeverity(request.params?.severity)
  };
}

function generateEmail(request: WorkerJobRequest): EmailDraft {
  const to = Array.isArray(request.params?.to) ? request.params.to.map(String) : ["analytics@example.com"];
  const subject = String(request.params?.subject ?? "Analytics workspace update");
  const message = String(request.params?.message ?? "Your analytics workspace job is complete.");

  return {
    to,
    subject,
    text: message,
    html: `<p>${escapeHtml(message)}</p>`
  };
}

function requireInputPath(request: WorkerJobRequest): string {
  if (!request.input?.path) {
    throw new Error("Input path is required for this job.");
  }

  return resolveWorkspacePath(request.input.path);
}

async function writeJson(path: string, payload: unknown) {
  const outputPath = resolveWorkspacePath(path);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(payload, null, 2), "utf-8");
}

function resolveWorkspacePath(path: string): string {
  if (isAbsolute(path)) {
    return path;
  }

  return resolve(fileURLToPath(new URL("../../..", import.meta.url)), path);
}

function normalizeSeverity(value: unknown): NotificationDraft["severity"] {
  return value === "success" || value === "warning" || value === "error" ? value : "info";
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export async function readWorkerRequest(path: string): Promise<WorkerJobRequest> {
  return JSON.parse(await readFile(path, "utf-8")) as WorkerJobRequest;
}
