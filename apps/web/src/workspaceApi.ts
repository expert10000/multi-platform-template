import { demoDashboardSnapshot, type DashboardSnapshot } from "@enterprise-analytics/core";

const defaultApiBaseUrl = "http://127.0.0.1:8787/api";

export type DashboardDataSource = "sqlite" | "local";

export interface DashboardSnapshotResult {
  snapshot: DashboardSnapshot;
  source: DashboardDataSource;
  statusText: string;
}

export async function getDashboardSnapshot(): Promise<DashboardSnapshotResult> {
  const apiBaseUrl = import.meta.env.VITE_ANALYTICS_API_URL ?? defaultApiBaseUrl;

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
