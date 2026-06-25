# Architecture

The template follows the same separation used by Math3D: platform shells at the edges, shared packages in the middle, and heavy processing in a worker.

```text
apps/desktop
  -> Electron main process
  -> SQLite repository layer
  -> React renderer

apps/web
  -> React workspace UI
  -> shared domain model

apps/mobile
  -> Expo / React Native workspace UI
  -> shared domain model

apps/maui
  -> .NET MAUI native workspace shell
  -> Windows, Android, iOS, and Mac Catalyst targets
  -> C# DTOs that consume the OpenAPI dashboard contract

services/worker-python
  -> Pandas CSV analysis
  -> JSON / HTML / PDF-ready output

services/worker-node
  -> CSV import and validation
  -> transformations, notifications, email drafts

services/worker-api-contract
  -> OpenAPI schema for dashboard and worker contracts
  -> TypeScript request/result envelope
```

## Data Flow

```text
CSV
  -> Asset Browser
  -> SQLite metadata
  -> Worker Job
  -> Analysis
  -> Report
  -> Dashboard
```

## SQLite Responsibilities

SQLite is the application database. It stores state, not bulk business facts.

Tables:

- `projects`
- `datasets`
- `jobs`
- `reports`
- `users`

Example records:

- Project: `Sales Forecast 2026`
- Dataset: `sales_q1.csv`
- Job: `KPI Analysis`
- Report: `sales_report_april.pdf`

## CSV Responsibilities

CSV and Excel files are business data imported by users.

Examples:

- sales: `date,region,revenue,cost`
- inventory: `product,stock,reorder_level`
- production: `machine,output,downtime`
- Online Retail: `InvoiceDate,Country,Quantity,UnitPrice`
- Superstore: `Order Date,Region,Sales`

Workers read CSV and Excel files, compute analysis or workflow results, and write report artifacts.

## Contract Boundary

OpenAPI is the cross-runtime boundary for app data. TypeScript packages keep the primary domain model, while C# clients such as MAUI consume matching DTOs generated from or aligned with `services/worker-api-contract/openapi.json`.

The starter contract includes:

- `GET /dashboard/snapshot` for the shared dashboard model.
- `POST /worker/jobs` for Python and Node worker requests.
- schema definitions for projects, datasets, jobs, reports, KPIs, and worker assets.

The MAUI app bundles `services/worker-api-contract/examples/dashboard-snapshot.json` as a local asset so the native shell can display real contract-shaped data before a live API is added.

## Worker Split

Python remains the analytics worker because it is natural for:

- Pandas
- NumPy
- Polars
- SciPy
- Matplotlib
- report generation

Example Python jobs:

- Sales KPI Analysis
- Forecasting
- CSV and Excel Processing
- PDF Reports

Node is added for JavaScript-native workflow jobs:

- CSV Import
- Data Validation
- Transformations
- Notifications
- Email generation

This gives JavaScript developers a familiar worker path while keeping serious analytics in Python.

## Worker Jobs

KPI Analysis:

- revenue
- profit
- margin
- growth
- region breakdown

Trend Analysis:

- trend series
- moving average
- simple forecast

Report Generation:

- executive summary
- KPI table
- trend table
- recommendations
