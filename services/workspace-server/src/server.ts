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
    :root { color: #172a34; background: #edf2f1; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 24px; }
    main { width: min(1120px, 100%); margin: 0 auto; }
    h1, h2, h3, p { margin-top: 0; }
    h1 { margin-bottom: 8px; font-size: clamp(1.8rem, 3vw, 2.5rem); letter-spacing: -0.04em; }
    h2 { margin-bottom: 12px; font-size: 1.1rem; letter-spacing: -0.02em; }
    h3 { margin-bottom: 4px; font-size: 0.98rem; }
    p { line-height: 1.45; }
    a { color: inherit; }
    code { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
    .surface-tabs { display: inline-flex; gap: 4px; margin-bottom: 12px; padding: 4px; background: #dce7e6; border: 1px solid #cbdad8; border-radius: 12px; }
    .surface-tabs a { padding: 9px 16px; border-radius: 9px; color: #44616d; font-size: 0.88rem; font-weight: 800; text-decoration: none; }
    .surface-tabs a:hover { color: #123b47; background: #eaf2f0; }
    .surface-tabs a.active { color: #113c47; background: #fff; box-shadow: 0 2px 8px #203b411a; }
    .shell { padding: 20px; background: #fff; border: 1px solid #d9e4e2; border-radius: 18px; box-shadow: 0 16px 45px #1b39410d; }
    .hero { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; padding: 25px 28px; color: #fff; background: linear-gradient(115deg, #142b3c, #245563); border-radius: 14px; }
    .hero p { max-width: 650px; margin: 0; color: #d8e8e9; }
    .eyebrow { display: block; margin-bottom: 8px; color: #91d5c1; font-size: 0.72rem; font-weight: 800; letter-spacing: 0.13em; text-transform: uppercase; }
    .badge, .state, .tag { display: inline-flex; align-items: center; border-radius: 999px; white-space: nowrap; font-size: 0.76rem; font-weight: 800; }
    .badge { gap: 7px; padding: 8px 12px; color: #dbffe8; background: #34745d; border: 1px solid #6bc296; }
    .badge::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: #a4f0ba; }
    section { margin-top: 24px; }
    .section-lead { margin: -5px 0 12px; color: #627780; font-size: 0.88rem; }
    .metric-grid, .status-grid, .app-grid, .tool-grid { display: grid; gap: 10px; }
    .metric-grid, .status-grid, .app-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .metric-grid { margin: 0; }
    .metric, .status-item, .app-card { min-width: 0; padding: 16px; border: 1px solid #dce7e4; border-radius: 12px; background: #fff; }
    .metric { background: #f8fbfa; }
    .metric dt { color: #617881; font-size: 0.74rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; }
    .metric dd { margin: 5px 0 0; color: #143746; font-size: 2rem; font-weight: 800; line-height: 1; }
    .status-item { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 12px 14px; }
    .status-item strong { font-size: 0.84rem; }
    .state { padding: 5px 9px; }
    .state.ok { color: #12613e; background: #dff6e9; }
    .state.bad { color: #902f27; background: #ffe5e0; }
    .state.pending { color: #795712; background: #fff0cb; }
    .app-card { padding: 15px; }
    .app-card p { min-height: 2.6em; margin: 0; color: #627780; font-size: 0.83rem; }
    .tag { margin-bottom: 9px; padding: 4px 8px; color: #27717d; background: #e5f3f3; }
    .app-card a { display: inline-block; margin-top: 10px; color: #166377; font-size: 0.83rem; font-weight: 800; text-decoration: none; }
    .app-card a:hover, .tool-grid a:hover { text-decoration: underline; }
    details { margin-top: 25px; padding: 0 16px; border: 1px solid #dce7e4; border-radius: 12px; background: #f8fbfa; }
    summary { padding: 15px 0; color: #264b58; font-size: 0.92rem; font-weight: 800; cursor: pointer; }
    .technical { padding: 0 0 18px; }
    .technical p { color: #627780; font-size: 0.85rem; }
    .database { padding: 10px 12px; background: #fff; border: 1px solid #dce7e4; border-radius: 8px; overflow-wrap: anywhere; }
    .database strong { display: block; margin-bottom: 4px; color: #617881; font-size: 0.72rem; text-transform: uppercase; }
    .tool-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .tool-grid a { padding: 10px 12px; color: #166377; background: #fff; border: 1px solid #dce7e4; border-radius: 8px; font-size: 0.83rem; font-weight: 800; text-decoration: none; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
    .action { padding: 8px 11px; color: #135368; background: #e5f3f3; border-radius: 8px; font-size: 0.83rem; font-weight: 800; text-decoration: none; }
    .action.danger { color: #84372d; background: #ffe6e0; }
    @media (max-width: 920px) { .metric-grid, .status-grid, .app-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .tool-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 600px) { body { padding: 12px; } .shell { padding: 12px; } .hero { flex-direction: column; padding: 20px; } .metric-grid, .status-grid, .app-grid, .tool-grid { grid-template-columns: 1fr; } .app-card p { min-height: 0; } .surface-tabs { display: flex; } .surface-tabs a { flex: 1; text-align: center; padding: 9px 8px; } }
  </style>
</head>
<body>
  <main>
    <nav class="surface-tabs" aria-label="Platform views">
      <a href="http://127.0.0.1:5184/" target="_blank" rel="noopener noreferrer">React Web</a>
      <a class="active" href="/" aria-current="page">Workspace Monitor</a>
    </nav>
    <div class="shell">
      <header class="hero">
        <div>
          <span class="eyebrow">Local platform service</span>
          <h1>Workspace Monitor</h1>
          <p>Workspace data, service state, and connected application hosts in one place.</p>
        </div>
        <span class="badge">Server ${escapeHtml(status.status)}</span>
      </header>

      <section aria-labelledby="data-title">
        <h2 id="data-title">Workspace data</h2>
        <p class="section-lead">Records stored in the local SQLite workspace.</p>
        <dl class="metric-grid">
          ${metrics.slice(0, 4).map(({ label, value }) => `<div class="metric"><dt>${escapeHtml(label)}</dt><dd>${value}</dd></div>`).join("")}
        </dl>
      </section>

      <section aria-labelledby="status-title">
        <h2 id="status-title">Service state</h2>
        <div class="status-grid">
          ${runtimeItems.map(({ label, state, tone }) => `<div class="status-item"><strong>${escapeHtml(label)}</strong><span class="state ${tone}">${escapeHtml(state)}</span></div>`).join("")}
        </div>
      </section>

      <section aria-labelledby="apps-title">
        <h2 id="apps-title">Application hosts</h2>
        <div class="app-grid">
          <article class="app-card"><span class="tag">Browser</span><h3>React Web</h3><p>Analytics dashboard and workspace UI.</p><a href="http://127.0.0.1:5184/" target="_blank" rel="noopener noreferrer">Open Web ↗</a></article>
          <article class="app-card"><span class="tag">Desktop</span><h3>Electron</h3><p>The same React UI in a desktop window.</p><a href="/launch/desktop">Launch Electron →</a></article>
          <article class="app-card"><span class="tag">Native C#</span><h3>.NET MAUI</h3><p>A separate native dashboard.</p><a href="/launch/maui">Launch on Windows →</a></article>
          <article class="app-card"><span class="tag">Expo</span><h3>React Native</h3><p>Mobile starter using demo data.</p></article>
        </div>
      </section>

      <details>
        <summary>Developer details and demo controls</summary>
        <div class="technical">
          <div class="database"><strong>SQLite database file</strong><code>${escapeHtml(status.databasePath)}</code></div>
          <p>Users: ${metrics[4].value} · Sample files: ${metrics[5].value}. The worker job API is not wired yet; worker scripts run from the command line.</p>
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
            <a class="action" href="/action/seed">Seed examples</a>
            <a class="action danger" href="/action/reset-demo" onclick="return confirm('Delete all workspace records in this SQLite file, then restore the built-in examples?')">Reset to examples</a>
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
