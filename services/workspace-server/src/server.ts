import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { openWorkspaceDatabase, SqliteWorkspaceRepository } from "@enterprise-analytics/workspace";

const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? "8787");
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");
const defaultDatabasePath = resolve(__dirname, "../../../.workspace/workspace.sqlite3");
const databasePath = resolve(process.env.WORKSPACE_DB_PATH ?? defaultDatabasePath);

mkdirSync(dirname(databasePath), { recursive: true });

const db = openWorkspaceDatabase(databasePath);
const repository = new SqliteWorkspaceRepository(db);
repository.seedDemoWorkspace();

type CountRow = { count: number };

const openApiPath = join(repoRoot, "services/worker-api-contract/openapi.json");
const sampleDataPath = join(repoRoot, "sample-data");

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
    <a href="/">Back to Workspace Server</a>
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
  const openApiSpec = readOpenApiSpec();
  const datasetCount = countTable("datasets");
  const reportCount = countTable("reports");
  const sampleFileCount = countFiles(sampleDataPath);
  const workerKindCount = openApiSpec.components?.schemas?.WorkerJobKind?.enum?.length ?? 0;
  const jobCount = countTable("jobs");

  return [
    ["Projects", countTable("projects")],
    ["Assets", datasetCount + reportCount + sampleFileCount],
    ["Datasets", datasetCount],
    ["Jobs", jobCount],
    ["Reports", reportCount],
    ["Users", countTable("users")],
    ["Tasks", jobCount + workerKindCount + reportCount]
  ] as const;
}

function getRuntimeItems() {
  return [
    ["SQLite", existsSync(databasePath)],
    ["REST API", true],
    ["OpenAPI", existsSync(openApiPath)],
    ["Demo Seed", countTable("projects") > 0],
    ["Repository", true],
    ["Worker Ready", readOpenApiSpec().components?.schemas?.WorkerJobKind?.enum?.length !== undefined]
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
  <title>Enterprise Server</title>
  <style>
    :root { color: #17202a; background: #f4f6f3; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; }
    main { width: min(1040px, 100%); background: #fff; border: 1px solid #dfe5df; border-radius: 8px; padding: 24px; }
    h1 { margin: 0; font-size: 1.6rem; letter-spacing: 0; }
    h2 { margin: 22px 0 10px; font-size: 1rem; letter-spacing: 0; text-transform: uppercase; color: #4f5d55; }
    p { color: #5e6a63; }
    .status-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 10px; }
    .badge { display: inline-flex; min-height: 34px; align-items: center; padding: 0 12px; border-radius: 8px; font-weight: 800; color: #0f3f2c; background: #c9f0d8; border: 1px solid #83c99e; }
    .path { overflow-wrap: anywhere; padding: 12px; background: #f7f9f7; border: 1px solid #e1e7e1; border-radius: 8px; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 0.9rem; }
    dl { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 12px; margin: 20px 0; }
    div.metric { padding: 14px; border: 1px solid #dfe5df; border-radius: 8px; }
    dt { color: #65736b; font-size: 0.78rem; font-weight: 800; text-transform: uppercase; }
    dd { margin: 4px 0 0; font-size: 1.4rem; font-weight: 800; }
    .runtime { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 10px; margin: 10px 0 18px; }
    .runtime-item { display: flex; min-height: 42px; align-items: center; justify-content: space-between; gap: 8px; padding: 0 12px; border-radius: 8px; background: #f7f9f7; border: 1px solid #dfe5df; font-weight: 800; }
    .runtime-ok { color: #0f3f2c; }
    .runtime-bad { color: #8f2f25; }
    .links { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-top: 18px; }
    .launch-links { margin-top: 12px; }
    a { display: inline-flex; min-height: 40px; align-items: center; justify-content: center; padding: 0 12px; color: #123c4d; background: #d7edf5; border: 1px solid #9bc9da; border-radius: 8px; font-weight: 800; text-decoration: none; }
    a.danger { color: #5c1f17; background: #ffd8d1; border-color: #e0a097; }
    a.future { color: #4f5d55; background: #edf1ed; border-color: #d3dbd3; }
    a:hover { background: #c1e2ee; }
    @media (max-width: 900px) { dl, .runtime, .links { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 640px) { .status-header { align-items: flex-start; flex-direction: column-reverse; gap: 10px; } dl, .runtime, .links { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main>
    <div class="status-header">
      <h1>Enterprise Server</h1>
      <span class="badge">SQLite API ${escapeHtml(status.status)}</span>
    </div>
    <p>Workspace Monitor for SQLite, OpenAPI, workers, and platform launch targets.</p>
    <div class="path">${escapeHtml(status.databasePath)}</div>
    <dl>
      ${metrics.map(([label, value]) => `<div class="metric"><dt>${escapeHtml(label)}</dt><dd>${value}</dd></div>`).join("")}
    </dl>
    <h2>Runtime Panel</h2>
    <section class="runtime" aria-label="Runtime status">
      ${runtimeItems.map(([label, ok]) => `<div class="runtime-item"><span>${escapeHtml(label)}</span><strong class="${ok ? "runtime-ok" : "runtime-bad"}">${ok ? "OK" : "OFF"}</strong></div>`).join("")}
    </section>
    <nav class="links" aria-label="Developer actions">
      <a href="/swagger">Open Swagger</a>
      <a href="/api-docs">Open API Docs</a>
      <a href="/database">Open Database</a>
      <a class="danger" href="/action/reset-demo">Reset Demo Data</a>
      <a href="/action/seed">Seed Workspace</a>
      <a href="/api/status">JSON Status</a>
      <a href="/api/dashboard/snapshot">Dashboard JSON</a>
      <a href="/openapi.json">OpenAPI JSON</a>
    </nav>
    <nav class="links launch-links" aria-label="Launch apps">
      <a href="http://127.0.0.1:5174/">Open Web</a>
      <a href="/launch/web">Start Web App</a>
      <a href="/launch/desktop">Open Electron</a>
      <a href="/launch/maui">Open MAUI</a>
      <a class="future" href="/launch/mobile">Open React Native (future)</a>
    </nav>
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
  <title>Swagger - Enterprise Server</title>
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
    <h1>Swagger</h1>
    <p>Local OpenAPI contract for the Enterprise Server.</p>
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
  <title>API Docs - Enterprise Server</title>
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
    <p>Developer endpoints exposed by the local Enterprise Server.</p>
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
  <title>Database Browser - Enterprise Server</title>
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
    openUrl("http://127.0.0.1:5174/");
    return "Web app launch requested and browser open requested.";
  }

  if (target === "desktop") {
    launchWebDevServer();
    const electronPath = join(repoRoot, "apps/desktop/node_modules/electron/dist/electron.exe");
    if (process.platform === "win32" && existsSync(electronPath)) {
      runDetached(electronPath, ["."], false, join(repoRoot, "apps/desktop"), {
        ANALYTICS_WEB_URL: "http://127.0.0.1:5174"
      });
    } else {
      runDetached(process.platform === "win32" ? "npm.cmd" : "npm", ["--workspace", "@enterprise-analytics/desktop", "run", "electron:dev"]);
    }
    return "Electron desktop launch requested.";
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
    writeMessagePage(response, "Starting Web App", launchTarget("web"));
    return;
  }

  if (route.method === "GET" && route.pathname === "/launch/desktop") {
    writeMessagePage(response, "Starting Electron Desktop", launchTarget("desktop"));
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
