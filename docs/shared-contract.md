# Shared Contract

The template uses OpenAPI as the boundary between platform apps and runtime services.

This keeps each platform free to use its natural language and UI stack:

- `apps/web` and `apps/desktop` use TypeScript and React.
- `apps/mobile` uses Expo / React Native.
- `apps/maui` uses C# and .NET MAUI.
- worker services can be implemented in Python, Node, or another runtime.

## Contract Files

- `services/worker-api-contract/openapi.json` is the source contract for cross-runtime app data.
- `services/worker-api-contract/src/index.ts` contains TypeScript worker request/result types.
- `services/worker-api-contract/examples/dashboard-snapshot.json` is a small contract-shaped dashboard payload.
- `services/workspace-server` serves the local OpenAPI-shaped API over HTTP.

## Current API Shape

The starter OpenAPI contract includes:

- `GET /dashboard/snapshot` for projects, datasets, jobs, reports, and KPI cards.
- `POST /worker/jobs` for worker execution requests.

The dashboard schema mirrors the main TypeScript domain model in `packages/core`, while remaining neutral enough for C# clients.

## .NET MAUI Consumption

The MAUI app does not import TypeScript code. Instead, it defines C# records in `apps/maui/Contracts` that match the OpenAPI dashboard schema.

For the starter template, MAUI calls `http://127.0.0.1:8787/api/dashboard/snapshot` and falls back to the bundled `dashboard-snapshot.json` raw asset when the local server is offline. Later, the same records can be generated from OpenAPI.

## Validation

Run:

```bash
npm run check:openapi
```

This verifies that the OpenAPI file and dashboard example are readable and include the required starter schemas.
