import { contextBridge, ipcRenderer } from "electron";
import type { DashboardSnapshot } from "@enterprise-analytics/core";

contextBridge.exposeInMainWorld("analyticsWorkspace", {
  getDashboardSnapshot: (): Promise<DashboardSnapshot> => ipcRenderer.invoke("workspace:dashboard")
});
