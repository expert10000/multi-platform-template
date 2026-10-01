# .NET MAUI

The optional native host lives in `apps/maui`. Its project targets Windows, Android, iOS, and Mac Catalyst; the local workflow in this repository is built for Windows.

The dashboard reads the Workspace Server snapshot and can fall back to a bundled example. Its Windows workflow can pick a CSV file, import it into the server, run a KPI job, generate an HTML report, and open the latest completed report. The C# DTOs in `apps/maui/Contracts` follow `packages/contracts/openapi.json`.

Run `npm run restore:maui` to restore dependencies and `npm run dev:maui` to launch the Windows host. `npm run build:maui:windows` builds the Windows target. A local Workspace Server is required for imports, jobs, and reports; the app starts it in development when needed. Other device targets need an API URL reachable from that device.

MAUI is separate from the default `npm run build` because it requires platform workloads.
