# .NET MAUI

The MAUI app lives in `apps/maui` and provides an optional native shell for the same Enterprise Platform domain.

Supported targets from the project file:

- Windows
- Android
- iOS
- Mac Catalyst

Responsibilities:

- native dashboard shell
- project, dataset, job, and report overview
- KPI cards
- C# DTOs aligned with the OpenAPI dashboard contract
- HTTP client for `http://127.0.0.1:8787/api/dashboard/snapshot`
- starts the local workspace server in development when it is not already running
- status badge for SQLite API data versus local fallback data
- future bridge to backend APIs, offline storage, or native file pickers

Contract source:

- `services/worker-api-contract/openapi.json`
- `services/worker-api-contract/examples/dashboard-snapshot.json`

The MAUI project starts or calls the local workspace server first. It also bundles the dashboard snapshot as a raw fallback asset and deserializes it into C# records under `apps/maui/Contracts`. This keeps MAUI independent from TypeScript internals while still displaying the same model shape as the web and desktop apps.

Setup:

```bash
npm run restore:maui
```

Run on Windows:

```bash
npm run dev:maui
```

Build a Windows package:

```bash
npm run build:maui:windows
```

MAUI is intentionally separate from the default `npm run build` path because it needs platform workloads that are not required for the Electron, web, Expo, and worker template.
