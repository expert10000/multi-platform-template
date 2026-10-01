# Shared Contract

The template uses OpenAPI as the boundary between platform apps and runtime services.

This keeps each platform free to use its natural language and UI stack:

- `apps/web` and `apps/desktop` use TypeScript and React.
- `apps/mobile` uses Expo / React Native.
- `apps/maui` uses C# and .NET MAUI.
- worker services can be implemented in Python, Node, or another runtime.

## Contract Files

- `packages/contracts/openapi.json` is the source contract for cross-runtime app data.
- `packages/contracts/src/index.ts` contains TypeScript worker request/result types.
- `packages/contracts/examples/dashboard-snapshot.json` is a small contract-shaped dashboard payload.
- `services/workspace-server` serves the local OpenAPI-shaped API over HTTP.

## Current API Shape

The starter OpenAPI contract includes:

- `GET /dashboard/snapshot` for projects, datasets, jobs, reports, and KPI cards.
- `POST /datasets` for a UTF-8 CSV import.
- `POST /worker/jobs` to queue a supported Python analytics job using `params.datasetId`.
- `GET /jobs/{id}` to follow persisted job state and errors.
- `GET /reports/{id}/content` to open generated JSON or HTML.

The dashboard schema mirrors the main TypeScript domain model in `packages/domain`, while remaining neutral enough for C# clients.

## .NET MAUI Consumption

The MAUI app does not import TypeScript code. Instead, it defines C# records in `apps/maui/Contracts` that match the OpenAPI dashboard schema.

MAUI calls `http://127.0.0.1:8797/api/dashboard/snapshot` and falls back to the bundled `dashboard-snapshot.json` raw asset when the local server is offline. Its Windows shell can import a CSV, queue Python jobs, refresh progress, and open generated reports through that same API.

## Validation

Run:

```bash
npm run check:openapi
```

This checks required routes, validates the example against required schema fields, and compares OpenAPI property names with the TypeScript and C# dashboard DTOs. It detects contract drift without generating clients.
