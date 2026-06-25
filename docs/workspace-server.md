# Workspace Server

The workspace server is the local database boundary for the template.

It exposes the shared OpenAPI contract over HTTP and keeps SQLite behind a repository interface. Platform apps should call this server instead of opening SQLite directly.

## Default Runtime

```text
http://127.0.0.1:8787
```

Current endpoints:

- `GET /`
- `GET /health`
- `GET /api/status`
- `GET /api/dashboard/snapshot`
- `POST /api/worker/jobs` placeholder, matching the OpenAPI contract

## Data Flow

```text
React Web
Electron Shell
.NET MAUI
Mobile
  -> HTTP localhost:8787
  -> workspace server
  -> packages/workspace repository
  -> SQLite
```

## Run

```bash
npm run workspace-server
```

The default database path is:

```text
.workspace/workspace.sqlite3
```

Set `WORKSPACE_DB_PATH` to point the server at another SQLite file.

## Electron

Electron is a client shell. It starts the built workspace server automatically when one is not already running, then loads the React UI.

That keeps desktop behavior aligned with browser, MAUI, and mobile clients:

```text
UI -> HTTP -> workspace server -> repository -> SQLite
```

## Data Source Status

Platform UIs show the current source:

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
