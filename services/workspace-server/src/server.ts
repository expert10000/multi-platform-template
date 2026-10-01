import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Dataset, Job, JobKind } from "@enterprise-analytics/core";
import { openWorkspaceDatabase, SqliteWorkspaceRepository } from "@enterprise-analytics/workspace";

const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? "8797");
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");
const defaultDatabasePath = resolve(__dirname, "../../../.workspace/workspace.sqlite3");
const databasePath = resolve(process.env.WORKSPACE_DB_PATH ?? defaultDatabasePath);
const webUrl = process.env.WORKSPACE_WEB_URL ?? "http://127.0.0.1:5184/";

mkdirSync(dirname(databasePath), { recursive: true });

const db = openWorkspaceDatabase(databasePath);
const repository = new SqliteWorkspaceRepository(db);
repository.seedDemoWorkspace();
repository.recoverInterruptedJobs();

type CountRow = { count: number };

const openApiPath = join(repoRoot, "packages/contracts/openapi.json");
const sampleDataPath = join(repoRoot, "data/sample");
const uploadDirectory = join(repoRoot, ".workspace/uploads");
const reportDirectory = join(repoRoot, ".workspace/reports");
mkdirSync(uploadDirectory, { recursive: true });
mkdirSync(reportDirectory, { recursive: true });

function writeError(response: ServerResponse, status: number, code: string, message: string) {
  writeJson(response, status, { error: { code, message } });
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 6_000_000) throw new Error("Request exceeds the 6 MB limit.");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

function recordOf(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function countCsvRows(content: string): number {
  let quoted = false;
  let rows = 0;
  let hasText = false;
  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    if (char === '"' && content[i + 1] === '"' && quoted) { i += 1; continue; }
    if (char === '"') quoted = !quoted;
    if (char === "\n" && !quoted) { if (hasText) rows += 1; hasText = false; }
    else if (char !== "\r" && !quoted) hasText = true;
  }
  if (quoted) throw new Error("CSV has an unterminated quoted field.");
  if (hasText) rows += 1;
  if (rows < 2) throw new Error("CSV needs a header and at least one data row.");
  return rows - 1;
}

function importDataset(body: unknown): Dataset {
  const value = recordOf(body);
  const name = value?.filename;
  const content = value?.content;
  if (typeof name !== "string" || !/^[^\\/]+\.csv$/i.test(name) || typeof content !== "string") {
    throw new Error("Provide a CSV filename and UTF-8 content.");
  }
  if (Buffer.byteLength(content, "utf8") > 5_000_000) throw new Error("CSV exceeds the 5 MB import limit.");
  const projectId = typeof value?.projectId === "string" ? value.projectId : repository.listProjects()[0]?.id;
  if (!projectId || !repository.listProjects().some((project) => project.id === projectId)) throw new Error("Choose an existing project.");
  const rowCount = countCsvRows(content);
  const id = `dataset-${randomUUID()}`;
  const sourcePath = `.workspace/uploads/${id}.csv`;
  writeFileSync(resolve(repoRoot, sourcePath), content, "utf8");
  const dataset: Dataset = { id, projectId, name, kind: "sales", sourcePath, rowCount, importedAt: new Date().toISOString() };
  repository.upsertDataset(dataset);
  return dataset;
}

function workerKind(kind: JobKind): "kpi" | "trend" | "report" {
  return kind === "trend-analysis" ? "trend" : kind === "report-generation" ? "report" : "kpi";
}

function startWorkerJob(job: Job) {
  const dataset = repository.getDataset(job.datasetId);
  if (!dataset) return;
  const extension = job.kind === "report-generation" ? "html" : "json";
  const outputPath = `.workspace/reports/${job.id}.${extension}`;
  const inputPath = resolve(repoRoot, dataset.sourcePath);
  const absoluteOutputPath = resolve(repoRoot, outputPath);
  const update = (status: Job["status"], errorMessage?: string) => {
    repository.upsertJob({ ...job, status, errorMessage, resultPath: status === "succeeded" ? outputPath : undefined, completedAt: status === "running" ? undefined : new Date().toISOString() });
  };
  if (!inputPath.startsWith(repoRoot + "\\") && !inputPath.startsWith(repoRoot + "/")) { update("failed", "Dataset path is outside the repository."); return; }
  if (!existsSync(inputPath)) { update("failed", "Dataset file is missing."); return; }
  update("running");
  const child = spawn(process.env.WORKSPACE_PYTHON ?? "python", [join(repoRoot, "services/workers/python/service/main.py"), "--job", workerKind(job.kind), "--input", inputPath, "--output", absoluteOutputPath], { cwd: repoRoot, windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
  let stderr = "";
  let finished = false;
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; child.kill(); }, 120_000);
  child.stderr.on("data", (chunk: Buffer) => { stderr = (stderr + chunk.toString()).slice(-1800); });
  const finish = (error?: string) => {
    if (finished) return;
    finished = true;
    clearTimeout(timeout);
    if (error || !existsSync(absoluteOutputPath)) { update("failed", (error || stderr.trim().split(/\r?\n/).at(-1) || "Worker produced no output.").slice(0, 300)); return; }
    update("succeeded");
    repository.upsertReport({ id: `report-${job.id}`, projectId: job.projectId, jobId: job.id, title: `${dataset.name} ${job.kind}`, format: extension, outputPath, createdAt: new Date().toISOString() });
  };
  child.on("error", (error) => finish(error.message));
  child.on("close", (code) => finish(timedOut ? "Worker exceeded 120 seconds." : code === 0 ? undefined : stderr || `Worker exited with code ${code}.`));
}

function submitWorkerJob(body: unknown): Job {
  const value = recordOf(body);
  const params = recordOf(value?.params);
  const datasetId = params?.datasetId;
  const kind = value?.kind;
  const requestId = value?.id;
  const mapping: Record<string, JobKind> = { "sales.kpi": "kpi-analysis", "sales.forecast": "trend-analysis", "report.html": "report-generation" };
  if (typeof datasetId !== "string" || typeof kind !== "string" || !mapping[kind] || value?.runtime !== "python" || typeof requestId !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(requestId) || typeof value?.requestedAt !== "string") {
    throw new Error("Provide a datasetId in params and a supported Python job kind: sales.kpi, sales.forecast, or report.html.");
  }
  if (repository.getJob(requestId)) throw new Error("Job ID already exists.");
  const dataset = repository.getDataset(datasetId);
  if (!dataset) throw new Error("Dataset not found.");
  if (dataset.kind !== "sales") throw new Error("The Python analytics worker requires a sales dataset.");
  const job: Job = { id: requestId, projectId: dataset.projectId, datasetId, kind: mapping[kind], status: "queued", requestedBy: "user-alex", createdAt: new Date().toISOString() };
  repository.upsertJob(job);
  setImmediate(() => startWorkerJob(job));
  return job;
}

function setCorsHeaders(response: ServerResponse) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function writeJson(response: ServerResponse, statusCode: number, payload: unknown) {
  setCorsHeaders(response);
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload, null, 2));
}

function writeMessagePage(response: ServerResponse, title: string, message: string) {
  setCorsHeaders(response);
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color: #17202a; background: #f4f6f3; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; }
    main { width: min(620px, 100%); background: #fff; border: 1px solid #dfe5df; border-radius: 8px; padding: 24px; }
    h1 { margin: 0 0 10px; font-size: 1.45rem; letter-spacing: 0; }
    p { color: #5e6a63; }
    a { display: inline-flex; min-height: 40px; align-items: center; justify-content: center; padding: 0 12px; color: #123c4d; background: #d7edf5; border: 1px solid #9bc9da; border-radius: 8px; font-weight: 800; text-decoration: none; }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
    <a href="/">Back to Workspace Monitor</a>
  </main>
</body>
</html>`);
}

function readOpenApiSpec() {
  return JSON.parse(readFileSync(openApiPath, "utf8")) as {
    paths?: Record<string, unknown>;
    components?: {
      schemas?: {
        WorkerJobKind?: {
          enum?: string[];
        };
      };
    };
  };
}

function countTable(tableName: "users" | "projects" | "datasets" | "jobs" | "reports") {
  return (db.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get() as CountRow).count;
}

function countFiles(directoryPath: string): number {
  if (!existsSync(directoryPath)) {
    return 0;
  }

  return readdirSync(directoryPath, { withFileTypes: true }).reduce((total, entry) => {
    const entryPath = join(directoryPath, entry.name);
    return total + (entry.isDirectory() ? countFiles(entryPath) : 1);
  }, 0);
}

function getMonitorMetrics() {
  return [
    { label: "Projects", value: countTable("projects"), detail: "Saved projects in SQLite." },
    { label: "Datasets", value: countTable("datasets"), detail: "Imported dataset records in SQLite." },
    { label: "Jobs", value: countTable("jobs"), detail: "Recorded jobs, not active worker processes." },
    { label: "Reports", value: countTable("reports"), detail: "Report records in SQLite." },
    { label: "Users", value: countTable("users"), detail: "User records in SQLite." },
    { label: "Sample files", value: countFiles(sampleDataPath), detail: "Files under data/sample on disk." }
  ] as const;
}

function getRuntimeItems() {
  return [
    { label: "SQLite", state: "Open", detail: "This server has opened the database file.", tone: "ok" },
    { label: "HTTP API", state: "Serving", detail: `Listening at http://${host}:${port}/api.`, tone: "ok" },
    { label: "OpenAPI contract", state: existsSync(openApiPath) ? "Available" : "Missing", detail: "Schema served at /openapi.json.", tone: existsSync(openApiPath) ? "ok" : "bad" },
    { label: "Worker job API", state: "Ready", detail: "Python analytics jobs are queued through POST /api/worker/jobs.", tone: "ok" }
  ] as const;
}

function resetDemoData() {
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM reports").run();
    db.prepare("DELETE FROM jobs").run();
    db.prepare("DELETE FROM datasets").run();
    db.prepare("DELETE FROM projects").run();
    db.prepare("DELETE FROM users").run();
  });
  tx();
  repository.seedDemoWorkspace();
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const monitorIconPaths = {
  database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10H3z"/>',
  gear: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9 7 7m10 10 2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/>',
  document: '<path d="M5 2h9l5 5v15H5zM14 2v6h5M8 13h8M8 17h6"/>',
  chart: '<path d="M3 20V4M3 20h18M7 16v-5M12 16V6M17 16V9"/>',
  pulse: '<path d="M2 12h5l3-7 4 14 3-7h5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c-3 3-3 15 0 18M12 3c3 3 3 15 0 18"/>',
  monitor: '<rect x="3" y="4" width="18" height="13" rx="1"/><path d="M8 21h8M12 17v4"/>',
  windows: '<path d="M3 4 11 3v8H3zM13 2.8 21 2v9h-8zM3 13h8v8l-8-1zM13 13h8v9l-8-1z"/>',
  phone: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/>',
  code: '<path d="m8 6-6 6 6 6M16 6l6 6-6 6M14 3 10 21"/>'
} as const;

function monitorIcon(name: keyof typeof monitorIconPaths) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${monitorIconPaths[name]}</svg>`;
}

function writeStatusPage(response: ServerResponse) {
  const status = getServerStatus();
  const metrics = getMonitorMetrics();
  const runtimeItems = getRuntimeItems();
  const metricVisuals = [
    { tone: "blue", icon: "folder" },
    { tone: "green", icon: "database" },
    { tone: "purple", icon: "gear" },
    { tone: "orange", icon: "document" }
  ] as const;
  const runtimeVisuals = [
    { icon: "database", subtitle: "Local database" },
    { icon: "globe", subtitle: "REST interface" },
    { icon: "document", subtitle: "API schema" },
    { icon: "gear", subtitle: "Background jobs" }
  ] as const;
  setCorsHeaders(response);
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Workspace Monitor</title>
  <style>
    :root { color: #112b48; background: #f4f9fc; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 14px 22px 26px; }
    main { width: min(1280px, 100%); margin: 0 auto; }
    h1, h2, h3, p { margin-top: 0; }
    h1 { margin-bottom: 5px; font-size: clamp(2rem, 3.4vw, 2.65rem); letter-spacing: -0.045em; line-height: 1.05; }
    h2 { margin-bottom: 2px; font-size: 1.3rem; letter-spacing: -0.025em; }
    h3 { margin-bottom: 4px; font-size: 1rem; }
    p { line-height: 1.45; }
    a { color: inherit; }
    svg { width: 24px; height: 24px; flex: none; }
    code { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
    .surface-tabs { display: inline-flex; gap: 4px; margin-bottom: 10px; padding: 4px; background: #e3edf1; border: 1px solid #d6e4eb; border-radius: 12px; }
    .surface-tabs a { padding: 8px 15px; border-radius: 9px; color: #436275; font-size: 0.85rem; font-weight: 800; text-decoration: none; }
    .surface-tabs a:hover { color: #0b5270; background: #eff7fa; }
    .surface-tabs a.active { color: #0c4e68; background: #fff; box-shadow: 0 2px 8px #1739541a; }
    .shell { padding: 20px; background: #fff; border: 1px solid #dbe9ef; border-radius: 18px; box-shadow: 0 14px 45px #1b496014; }
    .hero { position: relative; display: flex; align-items: center; gap: 30px; min-height: 156px; padding: 25px 30px; overflow: hidden; color: #fff; background: linear-gradient(110deg, #09253f 0%, #0c4160 55%, #087e99 100%); border-radius: 13px; }
    .hero-mark { z-index: 1; display: grid; width: 84px; height: 84px; flex: none; place-items: center; color: #9cecff; background: #ffffff15; border: 1px solid #5bd1e75c; border-radius: 16px; box-shadow: inset 0 0 24px #37c3e02d; }
    .hero-mark svg { width: 48px; height: 48px; stroke-width: 1.65; }
    .hero-copy { z-index: 1; }
    .hero p { max-width: 710px; margin: 0; color: #dbeaf2; font-size: 1rem; }
    .hero-wave { position: absolute; right: -15px; bottom: -8px; width: 45%; height: 112px; opacity: 0.55; }
    .eyebrow { display: block; margin-bottom: 8px; color: #80d5e8; font-size: 0.73rem; font-weight: 800; letter-spacing: 0.13em; text-transform: uppercase; }
    .badge, .state, .tag { display: inline-flex; align-items: center; border-radius: 999px; white-space: nowrap; font-size: 0.74rem; font-weight: 800; }
    .badge { position: absolute; z-index: 2; top: 20px; right: 22px; gap: 8px; padding: 8px 13px; color: #e1ffe9; background: #16826399; border: 1px solid #69d7a3; box-shadow: 0 0 0 3px #39d5a51a; }
    .badge::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: #a4f0ba; }
    section { margin-top: 24px; }
    .section-heading { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 13px; }
    .section-heading > svg { width: 28px; height: 28px; margin-top: 1px; color: #0d7995; stroke-width: 2.4; }
    .section-lead { margin: 0; color: #647f9b; font-size: 0.86rem; }
    .metric-grid, .status-grid, .app-grid, .tool-grid { display: grid; gap: 12px; }
    .metric-grid, .status-grid, .app-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .metric-grid { margin: 0; }
    .metric, .status-item, .app-card { min-width: 0; background: #fff; border: 1px solid #dce9f0; border-radius: 12px; box-shadow: 0 6px 16px #1c49600a; }
    .metric { position: relative; display: flex; align-items: center; gap: 18px; min-height: 104px; padding: 16px 18px; overflow: hidden; }
    .metric::after { content: ""; position: absolute; right: -8px; bottom: -14px; width: 108px; height: 42px; background: var(--soft); opacity: 0.55; border-radius: 75% 25% 0 0; transform: rotate(-13deg); }
    .metric-icon, .status-icon, .app-icon { display: grid; flex: none; place-items: center; border-radius: 15px; }
    .metric-icon { width: 56px; height: 56px; color: var(--accent); background: var(--soft); }
    .metric-icon svg { width: 29px; height: 29px; }
    .metric dt { color: #557396; font-size: 0.71rem; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; }
    .metric dd { margin: 5px 0 0; color: #0a2948; font-size: 2.25rem; font-weight: 800; line-height: 1; }
    .blue { --accent: #146da9; --soft: #e3f2ff; }
    .green { --accent: #049872; --soft: #d9f9ee; }
    .purple { --accent: #5e48b9; --soft: #eee9ff; }
    .orange { --accent: #ec790d; --soft: #fff0df; }
    .status-item { display: flex; align-items: center; gap: 12px; min-height: 82px; padding: 13px; }
    .status-icon { width: 46px; height: 46px; color: #126c9b; background: #e7f4fc; }
    .status-copy { min-width: 0; flex: 1; }
    .status-copy strong, .status-copy small { display: block; }
    .status-copy strong { font-size: 0.82rem; }
    .status-copy small { margin-top: 3px; color: #7189a3; font-size: 0.72rem; }
    .state { gap: 6px; padding: 6px 9px; }
    .state::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
    .state.ok { color: #137b4a; background: #dcf7e9; }
    .state.bad { color: #9b3429; background: #ffe5e0; }
    .state.pending { color: #a56a07; background: #fff0cd; }
    .app-card { display: flex; flex-direction: column; min-height: 190px; padding: 14px; }
    .app-top { display: flex; align-items: flex-start; gap: 12px; }
    .app-icon { width: 54px; height: 54px; color: var(--accent); background: var(--soft); }
    .app-icon svg { width: 28px; height: 28px; }
    .app-copy { min-width: 0; }
    .tag { margin-bottom: 5px; padding: 4px 9px; color: var(--accent); background: var(--soft); }
    .app-card p { margin: 0; color: #657e9a; font-size: 0.78rem; }
    .app-action { display: flex; align-items: center; justify-content: center; width: 100%; min-height: 37px; margin-top: auto; color: #075475; border: 1px solid #acd2e2; border-radius: 8px; font-size: 0.82rem; font-weight: 800; text-decoration: none; }
    .app-action:hover { background: #edf8fc; }
    .app-action.primary { color: #fff; background: linear-gradient(100deg, #075975, #036487); border-color: #075975; }
    .app-action.primary:hover { background: #08779b; }
    details { margin-top: 22px; padding: 0 17px; border: 1px solid #dce9f0; border-radius: 12px; background: #f8fbfd; }
    summary { display: flex; align-items: center; gap: 12px; padding: 15px 0; color: #173a59; font-size: 0.9rem; font-weight: 800; cursor: pointer; list-style: none; }
    summary::-webkit-details-marker { display: none; }
    summary::before { content: "›"; color: #125e81; font-size: 1.6rem; line-height: 0.8; transition: transform 0.15s; }
    details[open] summary::before { transform: rotate(90deg); }
    summary svg { color: #125e81; }
    .technical { padding: 0 0 18px; }
    .technical p { color: #627780; font-size: 0.85rem; }
    .database { padding: 10px 12px; background: #fff; border: 1px solid #dce9f0; border-radius: 8px; overflow-wrap: anywhere; }
    .database strong { display: block; margin-bottom: 4px; color: #617881; font-size: 0.72rem; text-transform: uppercase; }
    .tool-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .tool-grid a { padding: 10px 12px; color: #166377; background: #fff; border: 1px solid #dce9f0; border-radius: 8px; font-size: 0.83rem; font-weight: 800; text-decoration: none; }
    .tool-grid a:hover { text-decoration: underline; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
    .action { padding: 8px 11px; color: #135368; background: #e5f3f3; border: 0; border-radius: 8px; font-size: 0.83rem; font-weight: 800; text-decoration: none; cursor: pointer; }
    .action.danger { color: #84372d; background: #ffe6e0; }
    @media (max-width: 1050px) { .metric-grid, .status-grid, .app-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .hero-wave { width: 38%; } }
    @media (max-width: 680px) { body { padding: 10px; } .shell { padding: 13px; } .hero { gap: 15px; padding: 20px; } .hero-mark { width: 58px; height: 58px; } .hero-mark svg { width: 33px; height: 33px; } .hero-wave { display: none; } .badge { top: 12px; right: 12px; } .hero-copy { padding-top: 25px; } .status-grid { grid-template-columns: 1fr; } .surface-tabs { display: flex; } .surface-tabs a { flex: 1; text-align: center; padding: 9px 8px; } }
    @media (max-width: 480px) { .metric-grid, .app-grid, .tool-grid { grid-template-columns: 1fr; } .hero { flex-direction: column; align-items: flex-start; } .hero-copy { padding-top: 0; } .metric { min-height: 88px; } }
  </style>
</head>
<body>
  <main>
    <nav class="surface-tabs" aria-label="Platform views">
      <a href="${escapeHtml(webUrl)}" target="_blank" rel="noopener noreferrer">React Web</a>
      <a class="active" href="/" aria-current="page">Workspace Monitor</a>
    </nav>
    <div class="shell">
      <header class="hero">
        <span class="hero-mark">${monitorIcon("database")}</span>
        <div class="hero-copy">
          <span class="eyebrow">Local platform service</span>
          <h1>Workspace Monitor</h1>
          <p>Workspace data, service state, and connected application hosts in one place.</p>
        </div>
        <span class="badge">Server ${escapeHtml(status.status)}</span>
        <svg class="hero-wave" viewBox="0 0 480 120" preserveAspectRatio="none" aria-hidden="true"><path d="M0 120C95 113 129 82 182 62c54-21 69-61 128-49 47 9 62 51 170 64v43Z" fill="#38b9d6" opacity=".35"/><path d="M0 120C99 92 138 97 199 70c67-29 112-1 160 23 39 19 69 12 121-5" fill="none" stroke="#79dbeb" stroke-width="2" opacity=".45"/><path d="M75 120c93-48 157-26 225-55 66-29 103-17 180 10" fill="none" stroke="#5bcede" stroke-width="2" opacity=".4"/></svg>
      </header>

      <section aria-labelledby="data-title">
        <div class="section-heading">${monitorIcon("chart")}<div><h2 id="data-title">Workspace data</h2><p class="section-lead">Records stored in the local SQLite workspace.</p></div></div>
        <dl class="metric-grid">
          ${metrics.slice(0, 4).map(({ label, value }, index) => `<div class="metric ${metricVisuals[index].tone}"><span class="metric-icon">${monitorIcon(metricVisuals[index].icon)}</span><div><dt>${escapeHtml(label)}</dt><dd>${value}</dd></div></div>`).join("")}
        </dl>
      </section>

      <section aria-labelledby="status-title">
        <div class="section-heading">${monitorIcon("pulse")}<div><h2 id="status-title">Service state</h2><p class="section-lead">Status of local services and APIs.</p></div></div>
        <div class="status-grid">
          ${runtimeItems.map(({ label, state, tone }, index) => `<div class="status-item"><span class="status-icon">${monitorIcon(runtimeVisuals[index].icon)}</span><span class="status-copy"><strong>${escapeHtml(label)}</strong><small>${runtimeVisuals[index].subtitle}</small></span><span class="state ${tone}">${escapeHtml(state)}</span></div>`).join("")}
        </div>
      </section>

      <section aria-labelledby="apps-title">
        <div class="section-heading">${monitorIcon("monitor")}<div><h2 id="apps-title">Application hosts</h2><p class="section-lead">Launch and access the workspace using different client applications.</p></div></div>
        <div class="app-grid">
          <article class="app-card blue"><div class="app-top"><span class="app-icon">${monitorIcon("globe")}</span><div class="app-copy"><span class="tag">Browser</span><h3>React Web</h3><p>Analytics dashboard and workspace UI.</p></div></div><a class="app-action primary" href="${escapeHtml(webUrl)}" target="_blank" rel="noopener noreferrer">Open Web ↗</a></article>
          <article class="app-card green"><div class="app-top"><span class="app-icon">${monitorIcon("monitor")}</span><div class="app-copy"><span class="tag">Desktop</span><h3>Electron</h3><p>The same React UI in a desktop window.</p></div></div><a class="app-action" href="/launch/desktop">Launch Electron →</a></article>
          <article class="app-card purple"><div class="app-top"><span class="app-icon">${monitorIcon("windows")}</span><div class="app-copy"><span class="tag">Native C#</span><h3>.NET MAUI</h3><p>A separate native dashboard.</p></div></div><a class="app-action" href="/launch/maui">Launch on Windows →</a></article>
          <article class="app-card blue"><div class="app-top"><span class="app-icon">${monitorIcon("phone")}</span><div class="app-copy"><span class="tag">Expo</span><h3>React Native</h3><p>Mobile dashboard with API data and offline examples.</p></div></div><a class="app-action" href="https://github.com/expert10000/multi-platform-template/tree/main/apps/mobile" target="_blank" rel="noopener noreferrer">View project ↗</a></article>
        </div>
      </section>

      <details>
        <summary>${monitorIcon("code")}Developer details and demo controls</summary>
        <div class="technical">
          <div class="database"><strong>SQLite database file</strong><code>${escapeHtml(status.databasePath)}</code></div>
          <p>Users: ${metrics[4].value} · Sample files: ${metrics[5].value}. Python analytics jobs can also run through the local API.</p>
          <div class="tool-grid">
            <a href="/api-docs">API endpoint guide ↗</a>
            <a href="/swagger">OpenAPI route list ↗</a>
            <a href="/database">Browse SQLite ↗</a>
            <a href="/api/dashboard/snapshot">Dashboard JSON ↗</a>
            <a href="/api/status">Server status JSON ↗</a>
            <a href="/openapi.json">OpenAPI JSON ↗</a>
          </div>
          <p>Seed adds or updates example records. Reset deletes all workspace records in this database, then restores the built-in examples.</p>
          <div class="actions">
            <form method="post" action="/action/seed"><button class="action" type="submit">Seed examples</button></form>
            <form method="post" action="/action/reset-demo" onsubmit="return confirm('Delete all workspace records in this SQLite file, then restore the built-in examples?')"><button class="action danger" type="submit">Reset to examples</button></form>
          </div>
        </div>
      </details>
    </div>
  </main>
</body>
</html>`);
}

function writeSwaggerPage(response: ServerResponse) {
  const openApiSpec = readOpenApiSpec();
  const paths = Object.keys(openApiSpec.paths ?? {});
  setCorsHeaders(response);
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>OpenAPI Route List - Workspace Server</title>
  <style>
    :root { color: #17202a; background: #f4f6f3; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; }
    main { width: min(860px, 100%); background: #fff; border: 1px solid #dfe5df; border-radius: 8px; padding: 24px; }
    h1 { margin: 0 0 10px; letter-spacing: 0; }
    code, pre { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
    li { margin: 8px 0; }
    a { color: #123c4d; font-weight: 800; }
  </style>
</head>
<body>
  <main>
    <h1>OpenAPI Route List</h1>
    <p>Paths declared in the Workspace Server contract. Open the raw JSON for methods, schemas, and response details.</p>
    <p><a href="/openapi.json">Open raw OpenAPI JSON</a> · <a href="/">Back to monitor</a></p>
    <h2>Paths</h2>
    <ul>
      ${paths.map((pathName) => `<li><code>${escapeHtml(pathName)}</code></li>`).join("")}
    </ul>
  </main>
</body>
</html>`);
}

function writeApiDocsPage(response: ServerResponse) {
  setCorsHeaders(response);
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>API Docs - Workspace Server</title>
  <style>
    :root { color: #17202a; background: #f4f6f3; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; }
    main { width: min(860px, 100%); background: #fff; border: 1px solid #dfe5df; border-radius: 8px; padding: 24px; }
    h1 { margin: 0 0 10px; letter-spacing: 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 18px; }
    th, td { padding: 10px; border-bottom: 1px solid #e1e7e1; text-align: left; }
    code { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
    a { color: #123c4d; font-weight: 800; }
  </style>
</head>
<body>
  <main>
    <h1>API Docs</h1>
    <p>Developer endpoints exposed by the local Workspace Server.</p>
    <p><a href="/">Back to monitor</a> · <a href="/openapi.json">OpenAPI JSON</a></p>
    <table>
      <thead><tr><th>Method</th><th>Path</th><th>Purpose</th></tr></thead>
      <tbody>
        <tr><td>GET</td><td><code>/api/status</code></td><td>Runtime and storage status.</td></tr>
        <tr><td>GET</td><td><code>/api/dashboard/snapshot</code></td><td>Dashboard data from SQLite.</td></tr>
        <tr><td>POST</td><td><code>/api/datasets</code></td><td>Import a sales CSV.</td></tr>
        <tr><td>POST</td><td><code>/api/worker/jobs</code></td><td>Queue a Python analytics job.</td></tr>
        <tr><td>GET</td><td><code>/api/jobs/{id}</code></td><td>Read job progress and errors.</td></tr>
        <tr><td>GET</td><td><code>/api/reports/{id}/content</code></td><td>Open a generated report.</td></tr>
        <tr><td>GET</td><td><code>/database</code></td><td>SQLite table browser.</td></tr>
        <tr><td>POST</td><td><code>/action/seed</code></td><td>Seed demo records.</td></tr>
        <tr><td>POST</td><td><code>/action/reset-demo</code></td><td>Reset then seed demo records.</td></tr>
      </tbody>
    </table>
  </main>
</body>
</html>`);
}

function writeDatabasePage(response: ServerResponse) {
  const tableNames = ["users", "projects", "datasets", "jobs", "reports"] as const;
  const tableSections = tableNames.map((tableName) => {
    const rows = db.prepare(`SELECT * FROM ${tableName} LIMIT 5`).all() as Record<string, unknown>[];
    return `<section>
      <h2>${escapeHtml(tableName)} (${countTable(tableName)})</h2>
      <pre>${escapeHtml(JSON.stringify(rows, null, 2))}</pre>
    </section>`;
  }).join("");

  setCorsHeaders(response);
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Database Browser - Workspace Server</title>
  <style>
    :root { color: #17202a; background: #f4f6f3; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; min-height: 100vh; padding: 24px; }
    main { width: min(960px, 100%); margin: 0 auto; background: #fff; border: 1px solid #dfe5df; border-radius: 8px; padding: 24px; }
    h1 { margin: 0 0 10px; letter-spacing: 0; }
    h2 { margin-top: 22px; }
    pre { overflow: auto; padding: 14px; background: #f7f9f7; border: 1px solid #e1e7e1; border-radius: 8px; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 0.85rem; }
    a { color: #123c4d; font-weight: 800; }
  </style>
</head>
<body>
  <main>
    <h1>Database Browser</h1>
    <p>SQLite file: <code>${escapeHtml(databasePath)}</code></p>
    <p><a href="/">Back to monitor</a></p>
    ${tableSections}
  </main>
</body>
</html>`);
}

function runDetached(command: string, args: string[], hideWindow = false, workingDirectory = repoRoot, extraEnv: NodeJS.ProcessEnv = {}) {
  if (process.platform === "win32" && command.toLowerCase().endsWith(".exe")) {
    const child = spawn(command, args, {
      cwd: workingDirectory,
      detached: true,
      env: {
        ...process.env,
        ...extraEnv
      },
      stdio: "ignore",
      windowsHide: hideWindow
    });
    child.on("error", (error) => {
      console.error(`Failed to launch ${command}:`, error);
    });
    child.unref();
    return;
  }

  if (process.platform === "win32") {
    const programFiles = process.env.ProgramFiles ?? "C:\\Program Files";
    const resolvedCommand =
      command === "npm.cmd"
        ? join(programFiles, "nodejs", "npm.cmd")
        : command === "dotnet"
          ? join(programFiles, "dotnet", "dotnet.exe")
          : command;
    const windowStyle = hideWindow ? " -WindowStyle Hidden" : "";
    const psCommand = [
      "$ErrorActionPreference = 'Stop'",
      `$argsList = @(${args.map((arg) => `'${arg.replaceAll("'", "''")}'`).join(",")})`,
      `Start-Process -FilePath '${resolvedCommand.replaceAll("'", "''")}' -ArgumentList $argsList -WorkingDirectory '${workingDirectory.replaceAll("'", "''")}'${windowStyle}`
    ].join("; ");

    const child = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", psCommand], {
      cwd: repoRoot,
      detached: true,
      stdio: "ignore",
      windowsHide: true
    });
    child.on("error", (error) => {
      console.error(`Failed to launch ${command}:`, error);
    });
    child.unref();
    return;
  }

  const child = spawn(command, args, {
    cwd: workingDirectory,
    detached: true,
    env: {
      ...process.env,
      ...extraEnv
    },
    stdio: "ignore"
  });
  child.on("error", (error) => {
    console.error(`Failed to launch ${command}:`, error);
  });
  child.unref();
}

function openUrl(url: string) {
  if (process.platform === "win32") {
    runDetached("C:\\Windows\\System32\\cmd.exe", ["/c", "start", "", url], true);
    return;
  }

  runDetached(process.platform === "darwin" ? "open" : "xdg-open", [url]);
}

function launchWebDevServer() {
  if (process.platform === "win32") {
    runDetached("C:\\Windows\\System32\\cmd.exe", [
      "/c",
      "start",
      "Enterprise Web",
      "/min",
      "cmd.exe",
      "/c",
      `cd /d "${repoRoot}" && npm.cmd run dev:web:client`
    ], true);
    return;
  }

  runDetached("npm", ["run", "dev:web:client"]);
}

function launchTarget(target: "web" | "desktop" | "maui" | "mobile") {
  if (target === "web") {
    if (!process.env.WORKSPACE_WEB_URL) launchWebDevServer();
    openUrl(webUrl);
    return "Enterprise Platform Web launch requested and browser open requested.";
  }

  if (target === "desktop") {
    if (!process.env.WORKSPACE_WEB_URL) launchWebDevServer();
    const electronPath = join(repoRoot, "apps/desktop/node_modules/electron/dist/electron.exe");
    if (process.platform === "win32" && existsSync(electronPath)) {
      runDetached(electronPath, ["."], false, join(repoRoot, "apps/desktop"), {
        ANALYTICS_WEB_URL: webUrl
      });
    } else {
      runDetached(process.platform === "win32" ? "npm.cmd" : "npm", ["--workspace", "@enterprise-analytics/desktop", "run", "electron:dev"]);
    }
    return "Enterprise Platform desktop launch requested.";
  }

  if (target === "mobile") {
    return "React Native is planned for this monitor, but not launched from the server yet.";
  }

  const mauiExePath = join(repoRoot, "apps/maui/bin/Debug/net10.0-windows10.0.19041.0/win-x64/EnterpriseAnalytics.Maui.exe");
  if (process.platform === "win32" && existsSync(mauiExePath)) {
    runDetached(mauiExePath, [], false, repoRoot);
  } else {
    runDetached("dotnet", ["build", join(repoRoot, "apps/maui/EnterpriseAnalytics.Maui.csproj"), "-t:Run", "-f", "net10.0-windows10.0.19041.0"]);
  }
  return ".NET MAUI launch requested.";
}

function notFound(response: ServerResponse) {
  writeJson(response, 404, {
    error: {
      code: "not_found",
      message: "Route not found."
    }
  });
}

function getServerStatus() {
  return {
    status: "started",
    storage: "sqlite",
    databasePath
  };
}

function getRoute(request: IncomingMessage) {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? `${host}:${port}`}`);
  return {
    method: request.method ?? "GET",
    pathname: url.pathname
  };
}

const server = createServer((request, response) => {
  const route = getRoute(request);

  const origin = request.headers.origin;
  if (origin && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin) && origin !== "null") {
    writeError(response, 403, "origin_denied", "Only local application origins may call this server.");
    return;
  }

  if (route.method === "OPTIONS") {
    setCorsHeaders(response);
    response.writeHead(204);
    response.end();
    return;
  }

  if (route.method === "GET" && route.pathname === "/") {
    writeStatusPage(response);
    return;
  }

  if (route.method === "GET" && route.pathname === "/openapi.json") {
    writeJson(response, 200, readOpenApiSpec());
    return;
  }

  if (route.method === "GET" && route.pathname === "/swagger") {
    writeSwaggerPage(response);
    return;
  }

  if (route.method === "GET" && route.pathname === "/api-docs") {
    writeApiDocsPage(response);
    return;
  }

  if (route.method === "GET" && route.pathname === "/database") {
    writeDatabasePage(response);
    return;
  }

  if (route.method === "GET" && (route.pathname === "/health" || route.pathname === "/api/status")) {
    writeJson(response, 200, getServerStatus());
    return;
  }

  if (route.method === "GET" && route.pathname === "/launch/web") {
    writeMessagePage(response, "Starting Enterprise Platform Web", launchTarget("web"));
    return;
  }

  if (route.method === "GET" && route.pathname === "/launch/desktop") {
    writeMessagePage(response, "Starting Enterprise Platform", launchTarget("desktop"));
    return;
  }

  if (route.method === "GET" && route.pathname === "/launch/maui") {
    writeMessagePage(response, "Starting .NET MAUI", launchTarget("maui"));
    return;
  }

  if (route.method === "GET" && route.pathname === "/launch/mobile") {
    writeMessagePage(response, "React Native Future Target", launchTarget("mobile"));
    return;
  }

  if (route.method === "POST" && route.pathname === "/action/seed") {
    repository.seedDemoWorkspace();
    writeMessagePage(response, "Seed Workspace", "Demo workspace records were seeded.");
    return;
  }

  if (route.method === "POST" && route.pathname === "/action/reset-demo") {
    resetDemoData();
    writeMessagePage(response, "Reset Demo Data", "Demo workspace data was reset and seeded again.");
    return;
  }

  if (route.method === "GET" && route.pathname === "/api/dashboard/snapshot") {
    writeJson(response, 200, repository.getDashboardSnapshot());
    return;
  }

  if (route.method === "POST" && route.pathname === "/api/datasets") {
    void readJsonBody(request).then((body) => {
      const dataset = importDataset(body);
      writeJson(response, 201, dataset);
    }).catch((error: unknown) => writeError(response, 400, "invalid_dataset", error instanceof Error ? error.message : "Dataset import failed."));
    return;
  }

  const jobMatch = /^\/api\/jobs\/([^/]+)$/.exec(route.pathname);
  if (route.method === "GET" && jobMatch) {
    const job = repository.getJob(jobMatch[1]);
    if (!job) writeError(response, 404, "not_found", "Job not found.");
    else writeJson(response, 200, job);
    return;
  }

  const reportMatch = /^\/api\/reports\/([^/]+)\/content$/.exec(route.pathname);
  if (route.method === "GET" && reportMatch) {
    const report = repository.getReport(reportMatch[1]);
    if (!report) { writeError(response, 404, "not_found", "Report not found."); return; }
    const reportPath = resolve(repoRoot, report.outputPath);
    if (!reportPath.startsWith(reportDirectory + "\\") && !reportPath.startsWith(reportDirectory + "/")) { writeError(response, 404, "not_found", "Only generated reports can be opened here."); return; }
    if (!existsSync(reportPath)) { writeError(response, 404, "not_found", "Report file is missing."); return; }
    setCorsHeaders(response);
    response.writeHead(200, { "Content-Type": report.format === "html" ? "text/html; charset=utf-8" : "application/json; charset=utf-8", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'", "X-Content-Type-Options": "nosniff" });
    response.end(readFileSync(reportPath));
    return;
  }

  if (route.method === "POST" && route.pathname === "/api/worker/jobs") {
    void readJsonBody(request).then((body) => {
      const job = submitWorkerJob(body);
      writeJson(response, 202, job);
    }).catch((error: unknown) => writeError(response, 400, "invalid_job", error instanceof Error ? error.message : "Job submission failed."));
    return;
  }

  notFound(response);
});

server.listen(port, host, () => {
  console.log(`Workspace server listening on http://${host}:${port}`);
  console.log(`Workspace database: ${databasePath}`);
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
