export type EntityId = string;

export type DatasetKind = "sales" | "inventory" | "production" | "unknown";

export type JobKind = "kpi-analysis" | "trend-analysis" | "report-generation";

export type JobStatus = "queued" | "running" | "succeeded" | "failed";

export interface User {
  id: EntityId;
  displayName: string;
  email: string;
  role: "admin" | "analyst" | "viewer";
  createdAt: string;
}

export interface Project {
  id: EntityId;
  name: string;
  description: string;
  ownerId: EntityId;
  createdAt: string;
  updatedAt: string;
}

export interface Dataset {
  id: EntityId;
  projectId: EntityId;
  name: string;
  kind: DatasetKind;
  sourcePath: string;
  rowCount: number;
  importedAt: string;
}

export interface Job {
  id: EntityId;
  projectId: EntityId;
  datasetId: EntityId;
  kind: JobKind;
  status: JobStatus;
  requestedBy: EntityId;
  createdAt: string;
  completedAt?: string;
}

export interface Report {
  id: EntityId;
  projectId: EntityId;
  jobId: EntityId;
  title: string;
  format: "html" | "pdf" | "json";
  outputPath: string;
  createdAt: string;
}

export interface DashboardCounts {
  projects: number;
  datasets: number;
  jobs: number;
  reports: number;
}

export interface KpiSummary {
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
  growth: number;
}

export interface DashboardSnapshot {
  counts: DashboardCounts;
  kpis: KpiSummary;
  recentProjects: Project[];
  recentDatasets: Dataset[];
  recentJobs: Job[];
  recentReports: Report[];
}

export interface SalesCsvRow {
  date: string;
  region: string;
  revenue: number;
  cost: number;
}

export interface InventoryCsvRow {
  product: string;
  stock: number;
  reorder_level: number;
}

export interface ProductionCsvRow {
  machine: string;
  output: number;
  downtime: number;
}
