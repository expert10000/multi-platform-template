import { app, BrowserWindow } from "electron";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

let mainWindow: BrowserWindow | null = null;
let workspaceServerProcess: ChildProcess | null = null;
const __dirname = dirname(fileURLToPath(import.meta.url));
const workspaceServerUrl = process.env.ANALYTICS_WORKSPACE_SERVER_URL ?? "http://127.0.0.1:8787";
const repoRoot = join(__dirname, "../../..");

async function isWorkspaceServerAvailable() {
  try {
    const response = await fetch(`${workspaceServerUrl}/health`, {
      signal: AbortSignal.timeout(750)
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForWorkspaceServer() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (await isWorkspaceServerAvailable()) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return false;
}

async function isUrlAvailable(url: string) {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(750)
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForUrl(url: string) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (await isUrlAvailable(url)) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  return false;
}

async function ensureWorkspaceServer() {
  if (await isWorkspaceServerAvailable()) {
    return;
  }

  const serverEntry = join(repoRoot, "services/workspace-server/dist/server.js");
  if (!existsSync(serverEntry)) {
    console.warn(`Workspace server was not built: ${serverEntry}`);
    return;
  }

  const child = spawn(process.env.WORKSPACE_SERVER_NODE ?? "node", [serverEntry], {
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: "8787",
      WORKSPACE_DB_PATH: process.env.WORKSPACE_DB_PATH ?? (app.isPackaged ? join(app.getPath("userData"), "workspace.sqlite3") : join(repoRoot, ".workspace", "workspace.sqlite3"))
    },
    stdio: "ignore",
    windowsHide: true
  });
  workspaceServerProcess = child;
  child.unref();

  await waitForWorkspaceServer();
}

async function createMainWindow() {
  await ensureWorkspaceServer();

  mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 980,
    minHeight: 680,
    title: "Enterprise Analytics Workspace",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const devUrl = process.env.ANALYTICS_WEB_URL;
  if (devUrl) {
    await waitForUrl(devUrl);
    await mainWindow.loadURL(devUrl);
  } else {
    const webIndexPath = join(__dirname, "../../web/dist/index.html");
    if (existsSync(webIndexPath)) {
      await mainWindow.loadFile(webIndexPath);
    } else {
      await mainWindow.loadURL("http://127.0.0.1:5174");
    }
  }
}

app.whenReady().then(createMainWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  workspaceServerProcess?.kill();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createMainWindow();
  }
});
