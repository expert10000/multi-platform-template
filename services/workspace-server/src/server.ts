import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function writeStatusPage(response: ServerResponse) {
  const status = getServerStatus();
  const counts = repository.getDashboardSnapshot().counts;
  setCorsHeaders(response);
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Workspace Server</title>
  <style>
    :root { color: #17202a; background: #f4f6f3; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; }
    main { width: min(860px, 100%); background: #fff; border: 1px solid #dfe5df; border-radius: 8px; padding: 24px; }
    h1 { margin: 0 0 10px; font-size: 1.6rem; letter-spacing: 0; }
    p { color: #5e6a63; }
    .badge { display: inline-flex; min-height: 34px; align-items: center; padding: 0 12px; border-radius: 8px; font-weight: 800; color: #0f3f2c; background: #c9f0d8; border: 1px solid #83c99e; }
    .path { overflow-wrap: anywhere; padding: 12px; background: #f7f9f7; border: 1px solid #e1e7e1; border-radius: 8px; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 0.9rem; }
    dl { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 20px 0; }
    div.metric { padding: 14px; border: 1px solid #dfe5df; border-radius: 8px; }
    dt { color: #65736b; font-size: 0.78rem; font-weight: 800; text-transform: uppercase; }
    dd { margin: 4px 0 0; font-size: 1.4rem; font-weight: 800; }
    .links { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 18px; }
    .launch-links { margin-top: 12px; }
    a { display: inline-flex; min-height: 40px; align-items: center; justify-content: center; padding: 0 12px; color: #123c4d; background: #d7edf5; border: 1px solid #9bc9da; border-radius: 8px; font-weight: 800; text-decoration: none; }
    a:hover { background: #c1e2ee; }
    @media (max-width: 640px) { dl { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 640px) { .links { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main>
    <span class="badge">SQLite API ${escapeHtml(status.status)}</span>
    <h1>Workspace Server</h1>
    <p>This is the local API used by Web, Electron, and MAUI.</p>
    <div class="path">${escapeHtml(status.databasePath)}</div>
    <dl>
      <div class="metric"><dt>Projects</dt><dd>${counts.projects}</dd></div>
      <div class="metric"><dt>Datasets</dt><dd>${counts.datasets}</dd></div>
      <div class="metric"><dt>Jobs</dt><dd>${counts.jobs}</dd></div>
      <div class="metric"><dt>Reports</dt><dd>${counts.reports}</dd></div>
    </dl>
    <nav class="links" aria-label="Workspace server links">
      <a href="/api/status">JSON Status</a>
      <a href="/api/dashboard/snapshot">Dashboard JSON</a>
      <a href="http://127.0.0.1:5174/">Open Web App</a>
    </nav>
    <nav class="links launch-links" aria-label="Launch apps">
      <a href="/launch/web">Start Web App</a>
      <a href="/launch/desktop">Start Electron Desktop</a>
      <a href="/launch/maui">Start .NET MAUI</a>
    </nav>
  </main>
</body>
</html>`);
}

function runDetached(command: string, args: string[]) {
  const child = spawn(command, args, {
    cwd: repoRoot,
    detached: true,
    stdio: "ignore",
    windowsHide: true
  });
  child.unref();
}

function launchTarget(target: "web" | "desktop" | "maui") {
  if (target === "web") {
    runDetached(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "dev:web:client"]);
    return "Web app launch requested. Open http://127.0.0.1:5174/ after a moment.";
  }

  if (target === "desktop") {
    runDetached(process.platform === "win32" ? "npm.cmd" : "npm", ["--workspace", "@enterprise-analytics/desktop", "run", "electron:dev"]);
    return "Electron desktop launch requested.";
  }

  runDetached("dotnet", ["build", join(repoRoot, "apps/maui/EnterpriseAnalytics.Maui.csproj"), "-t:Run", "-f", "net10.0-windows10.0.19041.0"]);
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
