# Web

Enterprise Platform Web lives in `apps/web` and uses Vite + React.

Responsibilities:

- dashboard totals
- KPI cards
- asset browser
- job list
- report list
- project overview
- local workspace server integration

Development:

```bash
npm run dev:web
```

Build:

```bash
npm run build:web
```

Enterprise Platform Web calls `http://127.0.0.1:8787/api/dashboard/snapshot` through `apps/web/src/workspaceApi.ts`. It falls back to the shared demo snapshot from `packages/core` when the local Workspace Server is offline.

The top bar shows a colored data source badge:

- Green `SQLite API started` for workspace-server / SQLite data.
- Amber `Local fallback` for bundled demo data.
