# Web

The web app lives in `apps/web` and uses Vite + React.

Responsibilities:

- dashboard totals
- KPI cards
- asset browser
- job list
- report list
- project overview

Development:

```bash
npm run dev:web
```

Build:

```bash
npm run build:web
```

The web app currently uses the shared demo snapshot from `packages/core`. When embedded in Electron, it can be wired to `window.analyticsWorkspace.getDashboardSnapshot()` to read live SQLite state through the preload bridge.
