import type { DashboardSnapshot } from "./models.js";

const now = "2026-06-23T00:00:00.000Z";

export const demoDashboardSnapshot: DashboardSnapshot = {
  counts: {
    projects: 5,
    datasets: 26,
    jobs: 13,
    reports: 8
  },
  kpis: {
    revenue: 261000,
    cost: 171000,
    profit: 90000,
    margin: 0.345,
    growth: 0.167
  },
  recentProjects: [
    {
      id: "project-sales-forecast-2026",
      name: "Sales Forecast 2026",
      description: "Monthly sales and profitability forecast.",
      ownerId: "user-alex",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "project-inventory-risk",
      name: "Inventory Risk",
      description: "Reorder exceptions and stock-out risk.",
      ownerId: "user-morgan",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "project-real-retail-benchmarks",
      name: "Retail Benchmark Imports",
      description: "Real Online Retail and Superstore datasets for analysis demos.",
      ownerId: "user-alex",
      createdAt: now,
      updatedAt: now
    }
  ],
  recentDatasets: [
    {
      id: "dataset-online-retail-real",
      projectId: "project-real-retail-benchmarks",
      name: "Online Retail.xlsx",
      kind: "sales",
      sourcePath: "sample-data/real/online-retail/Online Retail.xlsx",
      rowCount: 541909,
      importedAt: now
    },
    {
      id: "dataset-superstore-real",
      projectId: "project-real-retail-benchmarks",
      name: "superstore_train.csv",
      kind: "sales",
      sourcePath: "sample-data/real/superstore-sales/train.csv",
      rowCount: 9800,
      importedAt: now
    },
    {
      id: "dataset-sales-q1",
      projectId: "project-sales-forecast-2026",
      name: "sales_q1.csv",
      kind: "sales",
      sourcePath: "sample-data/online-retail.csv",
      rowCount: 8,
      importedAt: now
    },
    {
      id: "dataset-production-week",
      projectId: "project-sales-forecast-2026",
      name: "production_week.csv",
      kind: "production",
      sourcePath: "sample-data/production.csv",
      rowCount: 4,
      importedAt: now
    }
  ],
  recentJobs: [
    {
      id: "job-kpi-analysis",
      projectId: "project-sales-forecast-2026",
      datasetId: "dataset-sales-q1",
      kind: "kpi-analysis",
      status: "succeeded",
      requestedBy: "user-alex",
      createdAt: now,
      completedAt: now
    },
    {
      id: "job-trend-analysis",
      projectId: "project-sales-forecast-2026",
      datasetId: "dataset-sales-q1",
      kind: "trend-analysis",
      status: "running",
      requestedBy: "user-alex",
      createdAt: now
    }
  ],
  recentReports: [
    {
      id: "report-sales-april",
      projectId: "project-sales-forecast-2026",
      jobId: "job-kpi-analysis",
      title: "sales_report_april.pdf",
      format: "pdf",
      outputPath: "reports/sales_report_april.pdf",
      createdAt: now
    }
  ]
};
