# Repository Layout

```text
multi-platform-template/
|-- apps/
|   |-- desktop/          # Electron shell
|   |-- mobile/           # Expo / React Native app
|   |-- maui/             # .NET MAUI native app
|   `-- web/              # Enterprise Platform Web
|-- packages/
|   |-- contracts/        # OpenAPI and TypeScript worker contracts
|   |-- domain/           # shared domain model
|   |-- ui/               # shared UI
|   `-- workspace/        # repository and SQLite schema
|-- services/
|   |-- workspace-server/ # local HTTP API over SQLite repository
|   `-- workers/
|       |-- python/        # Pandas analysis + report generation
|       `-- node/          # CSV import, validation, workflow automation
|-- data/
|   `-- sample/
|       |-- online-retail.csv
|       |-- superstore-sales.csv
|       `-- real/          # extracted real-world retail datasets
|-- docker/
|-- docs/
|   |-- architecture/
|   |-- hosts/
|   |-- images/
|   `-- operations/
|-- scripts/
|-- tests/
`-- README.md
```

This layout intentionally keeps platform-specific code out of shared packages. The web, Electron, Expo, and MAUI shells call the local workspace server through the shared HTTP contract, while the server owns SQLite access through `packages/workspace`.
