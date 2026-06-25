# Enterprise Analytics Workspace Template

This template mirrors the Math3D style of architecture, but changes the domain to an enterprise analytics workspace.

It keeps the same practical boundaries:

- `apps/desktop` - Electron shell that loads the web UI and starts the local workspace server.
- `apps/web` - React web app for the analytics dashboard and workspace UI.
- `apps/mobile` - Expo/React Native mobile shell.
- `apps/maui` - optional .NET MAUI native shell for Windows, Android, iOS, and Mac Catalyst.
- `packages/core` - shared domain model and analytics contracts.
- `packages/ui` - shared React UI primitives.
- `packages/workspace` - repository layer for projects, datasets, jobs, reports, and users.
- `services/worker-python` - Pandas worker for KPI, trend, and report generation jobs.
- `services/worker-api-contract` - shared OpenAPI and TypeScript request/result contract for platform shells and workers.
- `services/workspace-server` - local HTTP API over the shared SQLite repository.
- `services/worker-node` - Node worker for CSV import, validation, transformations, notifications, and email generation.
- `sample-data` - CSV business data for sales, inventory, and production examples.
- `sample-data/real` - larger real-world retail datasets extracted from user-provided archives.
- `docker` - containerized worker/runtime entrypoints.
- `docs` - architecture and platform notes.

## Platform Stack

- Desktop: Electron + React.
- Web: Vite + React.
- Mobile: Expo + React Native.
- Native cross-platform: .NET MAUI.
- Shared code: TypeScript workspace packages.
- Cross-runtime contract: OpenAPI for TypeScript, C#, workers, and native shells.
- Application database: SQLite behind the local workspace server.
- Business data: CSV files imported by users.
- Worker: Python + Pandas for analytics.
- Worker: Node for JavaScript-native workflow automation.
- Reports: JSON for machine-readable results, HTML/PDF-ready summaries for executives.

## Data Model

SQLite stores application state:

- `projects`
- `datasets`
- `jobs`
- `reports`
- `users`

CSV and Excel files store business facts:

- sales revenue and cost
- inventory stock and reorder levels
- production output and downtime
- real retail transactions and Superstore orders

## Run

Install dependencies:

```bash
npm install
```

Start the web app:

```bash
npm run dev:web
```

Start only the local workspace server:

```bash
npm run workspace-server
```

Start the desktop app:

```bash
npm run dev:desktop
```

Start the mobile app:

```bash
npm run dev:mobile
```

Restore and run the .NET MAUI app on Windows:

```bash
npm run restore:maui
npm run dev:maui
```

Run a sample KPI job:

```bash
python services/worker-python/service/main.py --job kpi --input sample-data/online-retail.csv --output reports/kpi-analysis.json
```

Run KPI jobs against the real imported datasets:

```bash
python services/worker-python/service/main.py --job kpi --input sample-data/real/superstore-sales/train.csv --output reports/superstore-kpi-analysis.json
python services/worker-python/service/main.py --job kpi --input "sample-data/real/online-retail/Online Retail.xlsx" --output reports/online-retail-kpi-analysis.json
```

Run Node workflow jobs:

```bash
npm run worker:node:import
npm run worker:node:validate
npm run worker:node:email
```

Check the OpenAPI contract:

```bash
npm run check:openapi
```

The shared contract is documented in `docs/shared-contract.md`. The workspace server is documented in `docs/workspace-server.md`. The .NET MAUI native shell is documented in `docs/maui.md`.

Run the web app in Docker:

```bash
npm run docker:web:build
npm run docker:web:run
```

Or use Compose:

```bash
npm run docker:compose
```

## Architecture Flow

```text
CSV import
  -> Asset Browser
  -> Workspace Server
  -> SQLite metadata
  -> Worker Job
  -> Analysis result
  -> Report
  -> Dashboard
```

Platform apps use the same local HTTP contract:

```text
Web / Electron / MAUI / Mobile
  -> http://127.0.0.1:8787
  -> packages/workspace repository
  -> SQLite
```

The starter UI shows:

- project, dataset, job, and report counts
- revenue, profit, and growth cards
- dataset/job/report lists
- realistic enterprise job types: KPI Analysis, Trend Analysis, Report Generation
- real sample datasets: Online Retail and Superstore Sales

## Worker Split

Python worker:

- Pandas / NumPy / Polars-style analytics
- forecasting
- CSV and Excel processing
- PDF or HTML reports

Node worker:

- CSV import previews
- data validation
- lightweight transformations
- notifications
- email draft generation
