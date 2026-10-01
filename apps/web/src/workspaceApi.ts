import { demoDashboardSnapshot, type DashboardSnapshot, type Dataset, type Job } from "@enterprise-analytics/core";

const defaultApiBaseUrl = "http://127.0.0.1:8797/api";
export const apiBaseUrl = import.meta.env.VITE_ANALYTICS_API_URL ?? defaultApiBaseUrl;

async function apiRequest<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const payload = await response.json() as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(payload.error?.message ?? `Workspace Server returned ${response.status}.`);
  return payload;
}

export async function importCsv(file: File, projectId?: string): Promise<Dataset> {
  return apiRequest<Dataset>("/datasets", { filename: file.name, content: await file.text(), projectId });
}

export async function submitJob(datasetId: string, kind: "sales.kpi" | "sales.forecast" | "report.html"): Promise<Job> {
  return apiRequest<Job>("/worker/jobs", { id: crypto.randomUUID(), kind, runtime: "python", requestedAt: new Date().toISOString(), params: { datasetId } });
}

export function reportContentUrl(id: string): string {
  return `${apiBaseUrl}/reports/${encodeURIComponent(id)}/content`;
}

export type DashboardDataSource = "sqlite" | "local";

export interface DashboardSnapshotResult {
  snapshot: DashboardSnapshot;
  source: DashboardDataSource;
  statusText: string;
}

export async function getDashboardSnapshot(): Promise<DashboardSnapshotResult> {
  try {
    const response = await fetch(`${apiBaseUrl}/dashboard/snapshot`);
    if (!response.ok) {
      throw new Error(`Workspace server returned ${response.status}.`);
    }

    return {
      snapshot: (await response.json()) as DashboardSnapshot,
      source: "sqlite",
      statusText: "SQLite API started"
    };
  } catch {
    return {
      snapshot: demoDashboardSnapshot,
      source: "local",
      statusText: "Local fallback"
    };
  }
}
