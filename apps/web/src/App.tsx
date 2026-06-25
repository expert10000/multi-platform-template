import { BarChart3, BriefcaseBusiness, Database, FileText, Play, Search, Settings, TableProperties } from "lucide-react";
import { useEffect, useState } from "react";
import { demoDashboardSnapshot, formatCurrency, formatPercent, type DashboardSnapshot } from "@enterprise-analytics/core";
import { DataTable, MetricCard, StatusBadge } from "@enterprise-analytics/ui";
import { getDashboardSnapshot, type DashboardDataSource } from "./workspaceApi";

type WorkspaceView = "dashboard" | "datasets" | "jobs" | "reports";

const viewTitles: Record<WorkspaceView, string> = {
  dashboard: "Enterprise Analytics Workspace",
  datasets: "Datasets",
  jobs: "Worker Jobs",
  reports: "Reports"
};

function jobTone(status: string) {
  if (status === "succeeded") {
    return "good";
  }
  if (status === "running" || status === "queued") {
    return "busy";
  }
  if (status === "failed") {
    return "bad";
  }
  return "neutral";
}

export function App() {
  const [dashboard, setDashboard] = useState<DashboardSnapshot>(demoDashboardSnapshot);
  const [dataSource, setDataSource] = useState<DashboardDataSource>("local");
  const [dataStatus, setDataStatus] = useState("Starting API");
  const [activeView, setActiveView] = useState<WorkspaceView>("dashboard");

  useEffect(() => {
    void getDashboardSnapshot().then((result) => {
      setDashboard(result.snapshot);
      setDataSource(result.source);
      setDataStatus(result.statusText);
    });
  }, []);

  const selectView = (view: WorkspaceView) => {
    setActiveView(view);
    window.history.replaceState(null, "", window.location.pathname);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const renderDatasetPanel = (wide = false) => (
    <article className={`panel ${wide ? "panel--wide" : ""}`}>
      <div className="panel__header">
        <div>
          <h2>Asset Browser</h2>
          <span>CSV and Excel files registered in SQLite metadata</span>
        </div>
        <button className="command-button" type="button">
          <TableProperties aria-hidden="true" size={18} />
          Import Data
        </button>
      </div>
      <DataTable
        columns={["Dataset", "Kind", "Rows", "Source"]}
        rows={dashboard.recentDatasets.map((dataset) => [
          dataset.name,
          dataset.kind,
          dataset.rowCount,
          dataset.sourcePath
        ])}
      />
    </article>
  );

  const renderJobsPanel = (wide = false) => (
    <article className={`panel ${wide ? "panel--wide" : ""}`}>
      <div className="panel__header">
        <div>
          <h2>Worker Jobs</h2>
          <span>Pandas-backed analysis pipeline</span>
        </div>
        <button className="command-button" type="button">
          <Play aria-hidden="true" size={18} />
          Run Job
        </button>
      </div>
      <DataTable
        columns={["Job", "Dataset", "Status"]}
        rows={dashboard.recentJobs.map((job) => [
          job.kind,
          job.datasetId.replace("dataset-", ""),
          <StatusBadge tone={jobTone(job.status)}>{job.status}</StatusBadge>
        ])}
      />
    </article>
  );

  const renderReportsPanel = (wide = false) => (
    <article className={`panel ${wide ? "panel--wide" : ""}`}>
      <div className="panel__header">
        <div>
          <h2>Reports</h2>
          <span>Executive summaries, KPI tables, charts, recommendations</span>
        </div>
        <button className="command-button" type="button">
          <FileText aria-hidden="true" size={18} />
          Generate
        </button>
      </div>
      <DataTable
        columns={["Report", "Format", "Path"]}
        rows={dashboard.recentReports.map((report) => [
          report.title,
          report.format.toUpperCase(),
          report.outputPath
        ])}
      />
    </article>
  );

  const renderProjectsPanel = () => (
    <article className="panel project-panel">
      <div className="panel__header">
        <div>
          <h2>Projects</h2>
          <span>Workspace entities stored in SQLite</span>
        </div>
        <BriefcaseBusiness aria-hidden="true" size={22} />
      </div>
      <div className="project-list">
        {dashboard.recentProjects.map((project) => (
          <div className="project-row" key={project.id}>
            <strong>{project.name}</strong>
            <span>{project.description}</span>
          </div>
        ))}
      </div>
    </article>
  );

  return (
    <main className="workspace-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark">EA</div>
          <div>
            <strong>Enterprise Analytics</strong>
            <span>Workspace</span>
          </div>
        </div>
        <nav className="primary-nav" aria-label="Primary navigation">
          <button className={`primary-nav__item ${activeView === "dashboard" ? "primary-nav__item--active" : ""}`} type="button" aria-pressed={activeView === "dashboard"} onClick={() => selectView("dashboard")}>
            <BarChart3 aria-hidden="true" size={18} />
            Dashboard
          </button>
          <button className={`primary-nav__item ${activeView === "datasets" ? "primary-nav__item--active" : ""}`} type="button" aria-pressed={activeView === "datasets"} onClick={() => selectView("datasets")}>
            <Database aria-hidden="true" size={18} />
            Datasets
          </button>
          <button className={`primary-nav__item ${activeView === "jobs" ? "primary-nav__item--active" : ""}`} type="button" aria-pressed={activeView === "jobs"} onClick={() => selectView("jobs")}>
            <Play aria-hidden="true" size={18} />
            Jobs
          </button>
          <button className={`primary-nav__item ${activeView === "reports" ? "primary-nav__item--active" : ""}`} type="button" aria-pressed={activeView === "reports"} onClick={() => selectView("reports")}>
            <FileText aria-hidden="true" size={18} />
            Reports
          </button>
        </nav>
        <button className="icon-button" type="button" title="Workspace settings" aria-label="Workspace settings">
          <Settings aria-hidden="true" size={18} />
        </button>
      </aside>

      <section className="workspace-main">
        <header className="topbar">
          <div>
            <span className="eyebrow">Option 1</span>
            <h1>{viewTitles[activeView]}</h1>
          </div>
          <div className="topbar__tools">
            <span className={`data-source-badge data-source-badge--${dataSource}`}>{dataStatus}</span>
            <label className="search-box">
              <Search aria-hidden="true" size={18} />
              <input placeholder="Search projects, datasets, jobs" />
            </label>
          </div>
        </header>

        {activeView === "dashboard" ? (
          <>
            <section className="count-grid" aria-label="Workspace totals">
              <MetricCard label="Projects" value={String(dashboard.counts.projects)} detail="active workspaces" />
              <MetricCard label="Datasets" value={String(dashboard.counts.datasets)} detail="CSV and Excel assets" />
              <MetricCard label="Jobs" value={String(dashboard.counts.jobs)} detail="analysis runs" />
              <MetricCard label="Reports" value={String(dashboard.counts.reports)} detail="published outputs" />
            </section>

            <section className="kpi-strip">
              <MetricCard label="Revenue" value={formatCurrency(dashboard.kpis.revenue)} detail="sample Q1" trend="up" />
              <MetricCard label="Profit" value={formatCurrency(dashboard.kpis.profit)} detail={`${formatPercent(dashboard.kpis.margin)} margin`} trend="up" />
              <MetricCard label="Growth" value={formatPercent(dashboard.kpis.growth)} detail="period over period" trend="up" />
            </section>

            <section className="workspace-grid">
              {renderDatasetPanel()}
              {renderJobsPanel()}
              {renderReportsPanel(true)}
              {renderProjectsPanel()}
            </section>
          </>
        ) : null}

        {activeView === "datasets" ? (
          <section className="workspace-grid workspace-grid--single">
            {renderDatasetPanel(true)}
            {renderProjectsPanel()}
          </section>
        ) : null}

        {activeView === "jobs" ? (
          <section className="workspace-grid workspace-grid--single">
            {renderJobsPanel(true)}
            <article className="panel">
              <div className="panel__header">
                <div>
                  <h2>Available Job Types</h2>
                  <span>Worker templates ready for CSV and Excel inputs</span>
                </div>
              </div>
              <DataTable
                columns={["Runtime", "Job Type", "Output"]}
                rows={[
                  ["Python", "Sales KPI Analysis", "revenue, profit, margin, growth"],
                  ["Python", "Forecasting", "moving average and forecast"],
                  ["Python", "PDF Reports", "executive report artifacts"],
                  ["Node", "CSV Import", "columns, row count, preview rows"],
                  ["Node", "Data Validation", "validity status and issues"],
                  ["Node", "Notifications", "workspace notification drafts"],
                  ["Node", "Email Generation", "HTML and plain-text email drafts"]
                ]}
              />
            </article>
          </section>
        ) : null}

        {activeView === "reports" ? (
          <section className="workspace-grid workspace-grid--single">
            {renderReportsPanel(true)}
            <article className="panel">
              <div className="panel__header">
                <div>
                  <h2>Report Pipeline</h2>
                  <span>How worker results become executive outputs</span>
                </div>
              </div>
              <DataTable
                columns={["Stage", "Artifact", "Owner"]}
                rows={[
                  ["Analysis", "KPI and trend JSON", "Python worker"],
                  ["Summary", "Recommendations and tables", "Report generator"],
                  ["Publish", "HTML or PDF-ready output", "Workspace repository"]
                ]}
              />
            </article>
          </section>
        ) : null}
      </section>
    </main>
  );
}
