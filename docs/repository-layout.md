# Repository Layout

```text
analysis-workspace-template/
|-- apps/
|   |-- desktop/          # Electron shell
|   |-- mobile/           # Expo / React Native app
|   |-- maui/             # .NET MAUI native app
|   `-- web/              # Enterprise Platform Web
|-- packages/
|   |-- core/             # shared domain model
|   |-- ui/               # shared UI
|   `-- workspace/        # repository and SQLite schema
|-- services/
|   |-- worker-api-contract/ # OpenAPI + TypeScript worker contracts
|   |-- workspace-server/    # local HTTP API over SQLite repository
|   |-- worker-python/       # Pandas analysis + report generation
|   `-- worker-node/         # CSV import, validation, workflow automation
|-- sample-data/
|   |-- online-retail.csv
|   |-- superstore-sales.csv
|   `-- real/             # extracted real-world retail datasets
|-- docker/
|-- docs/
|   |-- architecture.md
|   |-- desktop.md
|   |-- mobile.md
|   |-- maui.md
|   |-- shared-contract.md
|   |-- workspace-server.md
|   |-- web.md
|   `-- docker.md
`-- README.md
```

This layout intentionally keeps platform-specific code out of shared packages. The web, Electron, Expo, and MAUI shells call the local workspace server through the shared HTTP contract, while the server owns SQLite access through `packages/workspace`.
