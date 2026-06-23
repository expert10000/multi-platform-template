import { app, BrowserWindow, ipcMain } from "electron";
import { join } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { openWorkspaceDatabase, SqliteWorkspaceRepository } from "@enterprise-analytics/workspace";

let mainWindow: BrowserWindow | null = null;
let repository: SqliteWorkspaceRepository | null = null;
const __dirname = dirname(fileURLToPath(import.meta.url));

function getRepository() {
  if (!repository) {
    const databasePath = join(app.getPath("userData"), "workspace.sqlite3");
    const db = openWorkspaceDatabase(databasePath);
    repository = new SqliteWorkspaceRepository(db);
    repository.seedDemoWorkspace();
  }
  return repository;
}

async function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 980,
    minHeight: 680,
    title: "Enterprise Analytics Workspace",
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const devUrl = process.env.ANALYTICS_WEB_URL;
  if (devUrl) {
    await mainWindow.loadURL(devUrl);
  } else {
    await mainWindow.loadFile(join(__dirname, "../../web/dist/index.html"));
  }
}

ipcMain.handle("workspace:dashboard", () => {
  return getRepository().getDashboardSnapshot();
});

app.whenReady().then(createMainWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createMainWindow();
  }
});
