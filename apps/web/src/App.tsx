import { BarChart3, BriefcaseBusiness, ChevronDown, Database, ExternalLink, FileText, Folder, Play, Search, Settings2, TableProperties } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { demoDashboardSnapshot, formatCurrency, formatPercent, type DashboardSnapshot } from "@enterprise-analytics/core";
import { DataTable, MetricCard, StatusBadge } from "@enterprise-analytics/ui";
import { getDashboardSnapshot, type DashboardDataSource } from "./workspaceApi";

type WorkspaceView = "dashboard" | "datasets" | "jobs" | "reports";

const viewTitles: Record<WorkspaceView, string> = {
  dashboard: "Enterprise Platform",
  datasets: "Datasets",
  jobs: "Python Worker",
  reports: "Reports"
};

function DashboardCountCard({ label, value, detail, tone, icon }: { label: string; value: number; detail: string; tone: string; icon: ReactNode }) {
  return (
    <section className={`dashboard-count dashboard-count--${tone}`}>
      <span className="dashboard-count__icon" aria-hidden="true">{icon}</span>
      <div className="dashboard-count__copy">
        <span className="dashboard-count__label">{label}</span>
        <strong className="dashboard-count__value">{value}</strong>
        <span className="dashboard-count__detail">{detail}</span>
      </div>
      <svg className="dashboard-count__wave" viewBox="0 0 140 74" preserveAspectRatio="none" aria-hidden="true"><path d="M0 74 C23 63 28 41 51 42 S79 51 96 29 S124 0 140 6 L140 74 Z" /></svg>
    </section>
  );
}

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
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
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
          <h2>Python Worker</h2>
          <span>Background processing for analytics jobs</span>
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
      <header className="app-header">
        <div className="app-header__top">
          <div className="brand-lockup">
            <div className="brand-mark">EP</div>
            <strong>Enterprise Platform</strong>
          </div>
          <div className="app-header__actions">
            <a className="monitor-link" href="http://127.0.0.1:8797/" target="_blank" rel="noopener noreferrer">Workspace Monitor <ExternalLink aria-hidden="true" size={14} /></a>
            <span className="demo-avatar" title="Demo profile">JD</span>
            <ChevronDown aria-hidden="true" size={16} />
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
      </header>

      <section className="workspace-main">
        <header className="topbar">
          <div>
            <h1>{viewTitles[activeView]}</h1>
            <p>{activeView === "dashboard" ? "Turn your data into insights, anywhere." : "Explore your shared workspace data."}</p>
          </div>
          <div className="topbar__tools">
            <label className="search-box">
              <Search aria-hidden="true" size={18} />
              <input aria-label="Search projects, datasets, jobs" placeholder="Search projects, datasets, jobs..." />
            </label>
          </div>
        </header>

        {activeView === "dashboard" ? (
          <>
            <section className="count-grid" aria-label="Workspace totals">
              <DashboardCountCard label="Projects" value={dashboard.counts.projects} detail="active workspaces" tone="blue" icon={<Folder size={29} strokeWidth={2.4} />} />
              <DashboardCountCard label="Datasets" value={dashboard.counts.datasets} detail="CSV and Excel assets" tone="green" icon={<Database size={29} strokeWidth={2.4} />} />
              <DashboardCountCard label="Jobs" value={dashboard.counts.jobs} detail="analysis runs" tone="purple" icon={<Settings2 size={29} strokeWidth={2.4} />} />
              <DashboardCountCard label="Reports" value={dashboard.counts.reports} detail="published outputs" tone="orange" icon={<FileText size={29} strokeWidth={2.4} />} />
            </section>

            <section className="kpi-strip">
              <MetricCard label="Revenue" value={formatCurrency(dashboard.kpis.revenue)} detail="sample Q1" trend="up" />
              <MetricCard label="Profit" value={formatCurrency(dashboard.kpis.profit)} detail={`${formatPercent(dashboard.kpis.margin)} margin`} trend="up" />
              <MetricCard label="Growth" value={formatPercent(dashboard.kpis.growth)} detail="period over period" trend="up" />
            </section>

            <p className={`source-note source-note--${dataSource}`}><span aria-hidden="true" />{dataStatus}</p>

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
