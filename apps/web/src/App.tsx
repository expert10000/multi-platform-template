import { BarChart3, BriefcaseBusiness, ChevronDown, Database, ExternalLink, FileText, Folder, Play, Search, Settings2, TableProperties } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { demoDashboardSnapshot, formatCurrency, formatPercent, type DashboardSnapshot } from "@enterprise-analytics/core";
import { DataTable, MetricCard, StatusBadge } from "@enterprise-analytics/ui";
import { apiBaseUrl, getDashboardSnapshot, importCsv, reportContentUrl, submitJob, type DashboardDataSource } from "./workspaceApi";

type WorkspaceView = "dashboard" | "projects" | "datasets" | "jobs" | "reports";

const viewTitles: Record<WorkspaceView, string> = {
  dashboard: "Enterprise Platform",
  projects: "Projects",
  datasets: "Datasets",
  jobs: "Python Worker",
  reports: "Reports"
};

function DashboardCountCard({ label, value, detail, tone, icon, onClick }: { label: string; value: number; detail: string; tone: string; icon: ReactNode; onClick: () => void }) {
  return (
    <button className={`dashboard-count dashboard-count--${tone}`} type="button" onClick={onClick} aria-label={`Open ${label.toLowerCase()}, ${value} total`}>
      <span className="dashboard-count__icon" aria-hidden="true">{icon}</span>
      <div className="dashboard-count__copy">
        <span className="dashboard-count__label">{label}</span>
        <strong className="dashboard-count__value">{value}</strong>
        <span className="dashboard-count__detail">{detail}</span>
      </div>
      <svg className="dashboard-count__wave" viewBox="0 0 140 74" preserveAspectRatio="none" aria-hidden="true"><path d="M0 74 C23 63 28 41 51 42 S79 51 96 29 S124 0 140 6 L140 74 Z" /></svg>
    </button>
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
  const [query, setQuery] = useState("");
  const [selectedDatasetId, setSelectedDatasetId] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const refresh = () => void getDashboardSnapshot().then((result) => {
      setDashboard(result.snapshot);
      setDataSource(result.source);
      setDataStatus(result.statusText);
    });
    refresh();
    const timer = window.setInterval(refresh, 3000);
    return () => window.clearInterval(timer);
  }, []);

  const refreshDashboard = async () => {
    const result = await getDashboardSnapshot();
    setDashboard(result.snapshot);
    setDataSource(result.source);
    setDataStatus(result.statusText);
  };

  const matches = (...parts: Array<string | number | undefined>) => parts.some((part) => String(part ?? "").toLowerCase().includes(query.trim().toLowerCase()));
  const visibleProjects = dashboard.recentProjects.filter((project) => matches(project.name, project.description));
  const visibleDatasets = dashboard.recentDatasets.filter((dataset) => matches(dataset.name, dataset.kind, dataset.sourcePath));
  const visibleJobs = dashboard.recentJobs.filter((job) => matches(job.kind, job.status, job.datasetId, job.errorMessage));
  const visibleReports = dashboard.recentReports.filter((report) => matches(report.title, report.format, report.outputPath));
  const selectedDataset = dashboard.recentDatasets.find((dataset) => dataset.id === selectedDatasetId && dataset.kind === "sales") ?? dashboard.recentDatasets.find((dataset) => dataset.kind === "sales");

  const perform = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setNotice("");
    try {
      await action();
      await refreshDashboard();
      setNotice(success);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The action failed.");
    } finally {
      setBusy(false);
    }
  };

  const runJob = (kind: "sales.kpi" | "sales.forecast" | "report.html") => {
    if (!selectedDataset) { setNotice("Import or select a sales dataset first."); return; }
    void perform(() => submitJob(selectedDataset.id, kind), "Job queued. Its status and report will appear here.");
    setActiveView("jobs");
  };

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
        <button className="command-button" type="button" disabled={busy} onClick={() => fileInput.current?.click()}>
          <TableProperties aria-hidden="true" size={18} />
          Import CSV
        </button>
      </div>
      <DataTable
        columns={["Dataset", "Kind", "Rows", "Source"]}
        rows={visibleDatasets.map((dataset) => [
          dataset.name,
          dataset.kind,
          dataset.rowCount,
          dataset.sourcePath
        ])}
      />
      {visibleDatasets.length === 0 ? <p className="empty-state">No datasets match your search.</p> : null}
    </article>
  );

  const renderJobsPanel = (wide = false) => (
    <article className={`panel ${wide ? "panel--wide" : ""}`}>
      <div className="panel__header">
        <div>
          <h2>Python Worker</h2>
          <span>Import a sales CSV, then run analysis.</span>
        </div>
        <div className="panel__actions">
        <select className="dataset-picker" aria-label="Sales dataset for next job" value={selectedDataset?.id ?? ""} onChange={(event) => setSelectedDatasetId(event.target.value)}>
          {dashboard.recentDatasets.filter((dataset) => dataset.kind === "sales").map((dataset) => <option key={dataset.id} value={dataset.id}>{dataset.name}</option>)}
        </select>
        <button className="command-button" type="button" disabled={busy || !selectedDataset} onClick={() => runJob("sales.kpi")}>
          <Play aria-hidden="true" size={18} />
          Run KPI
        </button>
        <button className="command-button command-button--secondary" type="button" disabled={busy || !selectedDataset} onClick={() => runJob("sales.forecast")}>Run Trend</button>
        </div>
      </div>
      <DataTable
        columns={["Job", "Dataset", "Status", "Result"]}
        rows={visibleJobs.map((job) => [
          job.kind,
          dashboard.recentDatasets.find((dataset) => dataset.id === job.datasetId)?.name ?? job.datasetId,
          <span title={job.errorMessage ?? undefined}><StatusBadge tone={jobTone(job.status)}>{job.status}</StatusBadge>{job.errorMessage ? <small className="job-error">{job.errorMessage}</small> : null}</span>,
          job.status === "succeeded" && job.resultPath ? <a href={reportContentUrl(`report-${job.id}`)} target="_blank" rel="noopener noreferrer">Open report ↗</a> : "—"
        ])}
      />
      {visibleJobs.length === 0 ? <p className="empty-state">No jobs match your search.</p> : null}
    </article>
  );

  const renderReportsPanel = (wide = false) => (
    <article className={`panel ${wide ? "panel--wide" : ""}`}>
      <div className="panel__header">
        <div>
          <h2>Reports</h2>
          <span>Executive summaries, KPI tables, charts, recommendations</span>
        </div>
        <button className="command-button" type="button" disabled={busy || !selectedDataset} onClick={() => runJob("report.html")}>
          <FileText aria-hidden="true" size={18} />
          Generate HTML
        </button>
      </div>
      <DataTable
        columns={["Report", "Format", "Path"]}
        rows={visibleReports.map((report) => [
          report.outputPath.startsWith(".workspace/reports/") ? <a href={reportContentUrl(report.id)} target="_blank" rel="noopener noreferrer">{report.title} ↗</a> : report.title,
          report.format.toUpperCase(),
          report.outputPath
        ])}
      />
      {visibleReports.length === 0 ? <p className="empty-state">No reports match your search.</p> : null}
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
        {visibleProjects.map((project) => (
          <div className="project-row" key={project.id}>
            <strong>{project.name}</strong>
            <span>{project.description}</span>
          </div>
        ))}
        {visibleProjects.length === 0 ? <p className="empty-state">No projects match your search.</p> : null}
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
            <a className="monitor-link" href={new URL(apiBaseUrl).origin} target="_blank" rel="noopener noreferrer">Workspace Monitor <ExternalLink aria-hidden="true" size={14} /></a>
            <span className="demo-avatar" title="Demo profile">JD</span>
            <ChevronDown aria-hidden="true" size={16} />
          </div>
        </div>
        <nav className="primary-nav" aria-label="Primary navigation">
          <button className={`primary-nav__item ${activeView === "dashboard" ? "primary-nav__item--active" : ""}`} type="button" aria-pressed={activeView === "dashboard"} onClick={() => selectView("dashboard")}>
            <BarChart3 aria-hidden="true" size={18} />
            <span>Dashboard</span>
          </button>
          <button className={`primary-nav__item ${activeView === "projects" ? "primary-nav__item--active" : ""}`} type="button" aria-pressed={activeView === "projects"} onClick={() => selectView("projects")}>
            <Folder aria-hidden="true" size={18} />
            <span>Projects</span>
          </button>
          <button className={`primary-nav__item ${activeView === "datasets" ? "primary-nav__item--active" : ""}`} type="button" aria-pressed={activeView === "datasets"} onClick={() => selectView("datasets")}>
            <Database aria-hidden="true" size={18} />
            <span>Datasets</span>
          </button>
          <button className={`primary-nav__item ${activeView === "jobs" ? "primary-nav__item--active" : ""}`} type="button" aria-pressed={activeView === "jobs"} onClick={() => selectView("jobs")}>
            <Play aria-hidden="true" size={18} />
            <span>Jobs</span>
          </button>
          <button className={`primary-nav__item ${activeView === "reports" ? "primary-nav__item--active" : ""}`} type="button" aria-pressed={activeView === "reports"} onClick={() => selectView("reports")}>
            <FileText aria-hidden="true" size={18} />
            <span>Reports</span>
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
              <input aria-label="Search projects, datasets, jobs, reports" placeholder="Search workspace..." value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
          </div>
        </header>
        <input ref={fileInput} className="visually-hidden" type="file" accept=".csv,text/csv" aria-label="Choose a CSV to import" onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void perform(() => importCsv(file), `${file.name} imported. Select it in Jobs to run analysis.`);
          event.target.value = "";
        }} />
        {notice ? <div className="action-notice" role="status">{notice}</div> : null}

        {activeView === "dashboard" ? (
          <>
            <section className="count-grid" aria-label="Workspace totals">
              <DashboardCountCard label="Projects" value={dashboard.counts.projects} detail="active workspaces" tone="blue" icon={<Folder size={29} strokeWidth={2.4} />} onClick={() => selectView("projects")} />
              <DashboardCountCard label="Datasets" value={dashboard.counts.datasets} detail="CSV and Excel assets" tone="green" icon={<Database size={29} strokeWidth={2.4} />} onClick={() => selectView("datasets")} />
              <DashboardCountCard label="Jobs" value={dashboard.counts.jobs} detail="analysis runs" tone="purple" icon={<Settings2 size={29} strokeWidth={2.4} />} onClick={() => selectView("jobs")} />
              <DashboardCountCard label="Reports" value={dashboard.counts.reports} detail="published outputs" tone="orange" icon={<FileText size={29} strokeWidth={2.4} />} onClick={() => selectView("reports")} />
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

        {activeView === "projects" ? <section className="workspace-grid workspace-grid--single">{renderProjectsPanel()}</section> : null}

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
                  ["Python", "HTML Reports", "executive report artifacts"],
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
