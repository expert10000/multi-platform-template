# Web

Enterprise Platform Web lives in `apps/web` and uses Vite + React. It is the browser UI loaded by the Electron shell, so both hosts present the same workspace.

The app shows projects, datasets, jobs, reports, and dashboard KPIs. Users can search those records, import a CSV dataset, submit KPI or trend analysis, generate an HTML report, and open completed reports. It polls the Workspace Server for job progress.

Run it with `npm run dev:web` and build it with `npm run build:web`. The API client in `apps/web/src/workspaceApi.ts` uses the local Workspace Server at `http://127.0.0.1:8797` by default. Set `VITE_ANALYTICS_API_URL` to use a different local server port.

When the server is unavailable, the app displays the bundled demo snapshot and marks it as local fallback data. Import and job actions require a running server.
