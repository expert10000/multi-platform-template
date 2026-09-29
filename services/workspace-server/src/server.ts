import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { openWorkspaceDatabase, SqliteWorkspaceRepository } from "@enterprise-analytics/workspace";

const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? "8797");
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");
const defaultDatabasePath = resolve(__dirname, "../../../.workspace/workspace.sqlite3");
const databasePath = resolve(process.env.WORKSPACE_DB_PATH ?? defaultDatabasePath);

mkdirSync(dirname(databasePath), { recursive: true });

const db = openWorkspaceDatabase(databasePath);
const repository = new SqliteWorkspaceRepository(db);
repository.seedDemoWorkspace();

type CountRow = { count: number };

const openApiPath = join(repoRoot, "packages/contracts/openapi.json");
const sampleDataPath = join(repoRoot, "data/sample");

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
    { label: "Worker job API", state: "Not wired", detail: "POST /api/worker/jobs currently returns 501; run workers through their CLI scripts.", tone: "pending" }
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

function writeStatusPage(response: ServerResponse) {
  const status = getServerStatus();
  const metrics = getMonitorMetrics();
  const runtimeItems = getRuntimeItems();
  setCorsHeaders(response);
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Workspace Monitor</title>
  <style>
    :root { color: #17202a; background: #f4f6f3; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 24px; }
    main { width: min(1180px, 100%); margin: 0 auto; padding: 28px; background: #fff; border: 1px solid #dfe5df; border-radius: 12px; }
    h1, h2, h3, p { margin-top: 0; }
    h1 { margin-bottom: 6px; font-size: 1.7rem; }
    h2 { margin-bottom: 6px; font-size: 1.15rem; }
    h3 { margin-bottom: 0; font-size: 1rem; }
    p { color: #526159; line-height: 1.5; }
    section { margin-top: 30px; }
    .top, .card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; }
    .badge, .tag, .state { display: inline-flex; align-items: center; border-radius: 999px; font-size: 0.8rem; font-weight: 800; white-space: nowrap; }
    .badge { padding: 8px 12px; color: #0f3f2c; background: #d5f1df; border: 1px solid #83c99e; }
    .tag { padding: 4px 9px; color: #385667; background: #e9f3f8; }
    .state { padding: 4px 9px; }
    .state.ok { color: #0f5932; background: #dcf3e3; }
    .state.bad { color: #8f2f25; background: #ffe6e1; }
    .state.pending { color: #77550c; background: #fff1ca; }
    .database { margin-top: 14px; padding: 12px 14px; background: #f7f9f7; border: 1px solid #e1e7e1; border-radius: 8px; }
    .database strong { display: block; margin-bottom: 4px; font-size: 0.8rem; text-transform: uppercase; color: #526159; }
    .database code { overflow-wrap: anywhere; }
    .section-intro { margin-bottom: 16px; }
    .app-grid, .metric-grid, .status-grid, .tool-grid { display: grid; gap: 12px; }
    .app-grid, .status-grid, .tool-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .metric-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); margin: 0; }
    .card { min-width: 0; padding: 16px; border: 1px solid #dfe5df; border-radius: 10px; }
    .card p { margin: 9px 0 0; font-size: 0.9rem; }
    .command { display: block; margin-top: 10px; font-size: 0.83rem; color: #526159; }
    code { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
    a.action { display: inline-flex; min-height: 36px; align-items: center; padding: 6px 11px; border: 1px solid #9bc9da; border-radius: 7px; color: #123c4d; background: #d7edf5; font-size: 0.88rem; font-weight: 800; text-decoration: none; }
    a.action:hover { background: #c1e2ee; }
    a.action.danger { color: #67261d; background: #ffe0da; border-color: #e9a59a; }
    .metric dt { color: #526159; font-size: 0.8rem; font-weight: 800; text-transform: uppercase; }
    .metric dd { margin: 5px 0; font-size: 1.55rem; font-weight: 800; }
    .tool a { color: #123c4d; font-weight: 800; }
    .note { padding: 12px 14px; border-radius: 8px; background: #fff8e9; border: 1px solid #f2dbad; }
    @media (max-width: 760px) { .app-grid, .metric-grid, .status-grid, .tool-grid { grid-template-columns: 1fr; } .top { flex-direction: column; } }
    @media (max-width: 520px) { body { padding: 10px; } main { padding: 18px; } }
  </style>
</head>
<body>
  <main>
    <div class="top">
      <div>
        <h1>Workspace Server</h1>
        <p>This is the local API and data monitor. The applications below are separate hosts that use workspace data.</p>
      </div>
      <span class="badge">Server ${escapeHtml(status.status)}</span>
    </div>
    <div class="database"><strong>SQLite database file</strong><code>${escapeHtml(status.databasePath)}</code></div>

    <section aria-labelledby="apps-title">
      <h2 id="apps-title">Applications in this repository</h2>
      <p class="section-intro">Four application hosts are present. The workspace server on this page is their backend, not another user-facing app.</p>
      <div class="app-grid">
        <article class="card">
          <div class="card-head"><h3>React Web</h3><span class="tag">Browser</span></div>
          <p>Dashboard and workspace UI. It reads the SQLite-backed snapshot from this server, with bundled demo data as a fallback.</p>
          <div class="actions"><a class="action" href="http://127.0.0.1:5184/">Open Web app</a></div>
          <span class="command">Start locally: <code>npm run dev:web</code></span>
        </article>
        <article class="card">
          <div class="card-head"><h3>Electron Desktop</h3><span class="tag">Desktop</span></div>
          <p>Native window for the same React Web UI. It connects to the workspace server and can start it when needed.</p>
          <div class="actions"><a class="action" href="/launch/desktop">Launch Electron</a></div>
          <span class="command">Start locally: <code>npm run dev:desktop</code></span>
        </article>
        <article class="card">
          <div class="card-head"><h3>.NET MAUI</h3><span class="tag">Native C#</span></div>
          <p>Separate native dashboard using the same HTTP snapshot contract. This launch action targets Windows.</p>
          <div class="actions"><a class="action" href="/launch/maui">Launch MAUI on Windows</a></div>
          <span class="command">Start locally: <code>npm run dev:maui</code></span>
        </article>
        <article class="card">
          <div class="card-head"><h3>React Native</h3><span class="tag">Expo</span></div>
          <p>Mobile shell for Android and iOS. It currently shows shared demo data; server integration and launching from this page are not wired.</p>
          <span class="command">Start locally: <code>npm run dev:mobile</code></span>
        </article>
      </div>
    </section>

    <section aria-labelledby="data-title">
      <h2 id="data-title">Workspace data</h2>
      <p class="section-intro">Counts are SQLite records except for sample files, which are counted on disk.</p>
      <dl class="metric-grid">
        ${metrics.map(({ label, value, detail }) => `<div class="card metric"><dt>${escapeHtml(label)}</dt><dd>${value}</dd><p>${escapeHtml(detail)}</p></div>`).join("")}
      </dl>
    </section>

    <section aria-labelledby="status-title">
      <h2 id="status-title">Service status</h2>
      <div class="status-grid">
        ${runtimeItems.map(({ label, state, detail, tone }) => `<div class="card"><div class="card-head"><h3>${escapeHtml(label)}</h3><span class="state ${tone}">${escapeHtml(state)}</span></div><p>${escapeHtml(detail)}</p></div>`).join("")}
      </div>
    </section>

    <section aria-labelledby="tools-title">
      <h2 id="tools-title">Inspect the server</h2>
      <div class="tool-grid">
        <div class="card tool"><a href="/api-docs">API endpoint guide</a><p>Methods and purposes for the local HTTP endpoints.</p></div>
        <div class="card tool"><a href="/swagger">OpenAPI route list</a><p>Paths declared in the contract; this is not an interactive Swagger console.</p></div>
        <div class="card tool"><a href="/database">Browse SQLite records</a><p>Shows the first five rows in each workspace table.</p></div>
        <div class="card tool"><a href="/api/dashboard/snapshot">Dashboard JSON</a><p>The snapshot read by Web, Electron, and MAUI.</p></div>
        <div class="card tool"><a href="/api/status">Server status JSON</a><p>Server state, storage type, and database path.</p></div>
        <div class="card tool"><a href="/openapi.json">OpenAPI contract JSON</a><p>The machine-readable API and worker schema.</p></div>
      </div>
    </section>

    <section aria-labelledby="demo-title">
      <h2 id="demo-title">Demo data controls</h2>
      <p class="note">Seed adds or updates the built-in example records by ID. Reset deletes every user, project, dataset, job, and report record in the SQLite file above, then restores the built-in examples.</p>
      <div class="actions">
        <a class="action" href="/action/seed">Seed example records</a>
        <a class="action danger" href="/action/reset-demo" onclick="return confirm('Delete all workspace records in this SQLite file, then restore the built-in examples?')">Reset all records to examples</a>
      </div>
    </section>
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
        <tr><td>POST</td><td><code>/api/worker/jobs</code></td><td>Worker contract placeholder.</td></tr>
        <tr><td>GET</td><td><code>/database</code></td><td>SQLite table browser.</td></tr>
        <tr><td>GET</td><td><code>/action/seed</code></td><td>Seed demo records.</td></tr>
        <tr><td>GET</td><td><code>/action/reset-demo</code></td><td>Reset then seed demo records.</td></tr>
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
    launchWebDevServer();
    openUrl("http://127.0.0.1:5184/");
    return "Enterprise Platform Web launch requested and browser open requested.";
  }

  if (target === "desktop") {
    launchWebDevServer();
    const electronPath = join(repoRoot, "apps/desktop/node_modules/electron/dist/electron.exe");
    if (process.platform === "win32" && existsSync(electronPath)) {
      runDetached(electronPath, ["."], false, join(repoRoot, "apps/desktop"), {
        ANALYTICS_WEB_URL: "http://127.0.0.1:5184"
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

  if (route.method === "GET" && route.pathname === "/action/seed") {
    repository.seedDemoWorkspace();
    writeMessagePage(response, "Seed Workspace", "Demo workspace records were seeded.");
    return;
  }

  if (route.method === "GET" && route.pathname === "/action/reset-demo") {
    resetDemoData();
    writeMessagePage(response, "Reset Demo Data", "Demo workspace data was reset and seeded again.");
    return;
  }

  if (route.method === "GET" && route.pathname === "/api/dashboard/snapshot") {
    writeJson(response, 200, repository.getDashboardSnapshot());
    return;
  }

  if (route.method === "POST" && route.pathname === "/api/worker/jobs") {
    writeJson(response, 501, {
      error: {
        code: "not_implemented",
        message: "Worker job execution is defined in OpenAPI but not wired to this local workspace server yet."
      }
    });
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
