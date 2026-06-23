import type { DashboardSnapshot } from "@enterprise-analytics/core";

declare global {
  interface Window {
    analyticsWorkspace?: {
      getDashboardSnapshot: () => Promise<DashboardSnapshot>;
    };
  }
}
