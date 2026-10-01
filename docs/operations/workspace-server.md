# Workspace Server

The workspace server is the local database boundary for the template.

It exposes the shared OpenAPI contract over HTTP and keeps SQLite behind a repository interface. Platform apps should call this server instead of opening SQLite directly.

## Default Runtime

```text
http://127.0.0.1:8797
```

Current endpoints:

- `GET /`
- `GET /health`
- `GET /api/status`
- `GET /api/dashboard/snapshot`
- `POST /api/datasets` to import a UTF-8 CSV (5 MB maximum)
- `POST /api/worker/jobs` to queue `sales.kpi`, `sales.forecast`, or `report.html` for a dataset
- `GET /api/jobs/{id}` for persisted job state and failure details
- `GET /api/reports/{id}/content` to open generated JSON or HTML

## Data Flow

```text
React Web
Electron Shell
.NET MAUI
Expo/React Native (when the server is reachable)
  -> HTTP localhost:8797
  -> workspace server
  -> packages/workspace repository
  -> SQLite
```

Expo/React Native falls back to the shared demo snapshot if the server cannot be reached. On a physical device, provide a reachable `EXPO_PUBLIC_WORKSPACE_API_URL` and run the server on an address that device can reach. The local server has no authentication; use it only in a trusted development environment.

## Run

```bash
npm run workspace-server
```

The default database path is:

```text
.workspace/workspace.sqlite3
```

Set `WORKSPACE_DB_PATH` to point the server at another SQLite file.

Install Python dependencies before using the analytics buttons:

```bash
python -m pip install -r services/workers/python/requirements.txt
```

The browser sends CSV text to `POST /api/datasets`; the server stores the file in `.workspace/uploads` and its metadata in SQLite. A worker request supplies `params.datasetId`, `runtime: "python"`, and a supported kind. The server queues the job, persists its status, runs the Python worker, and writes successful output under `.workspace/reports`. Failed jobs retain a readable error. Jobs left queued or running after a server restart are marked failed.

## Electron

Electron is a client shell. It starts the built workspace server automatically when one is not already running, then loads the React UI.

That keeps desktop behavior aligned with the browser and MAUI clients:

```text
UI -> HTTP -> workspace server -> repository -> SQLite
```

## Data Source Status

The Web, Electron, and MAUI UIs show the current source:

- Green `SQLite API started` means the app is reading through the workspace server and SQLite.
- Amber `Local fallback` means the app is using bundled/demo data because the server was not available.

## Future Databases

Because UI apps speak HTTP and the server owns the repository, the database can later move behind the same contract:

```text
SQLite
DuckDB
PostgreSQL
SQL Server
```
