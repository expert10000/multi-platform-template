# Repository Layout

```text
analysis-workspace-template/
├─ apps/
│  ├─ desktop/          # Electron shell
│  ├─ mobile/           # Expo / React Native app
│  ├─ maui/             # .NET MAUI native app
│  └─ web/              # React web app
├─ packages/
│  ├─ core/             # shared domain model
│  ├─ ui/               # shared UI
│  └─ workspace/        # projects, datasets, jobs, reports
├─ services/
│  ├─ worker-api-contract/ # OpenAPI + TypeScript worker contracts
│  ├─ worker-python/    # Pandas analysis + report generation
│  └─ worker-node/      # CSV import, validation, workflow automation
├─ sample-data/
│  ├─ online-retail.csv
│  ├─ superstore-sales.csv
│  └─ real/             # extracted real-world retail datasets
├─ docker/
├─ docs/
│  ├─ architecture.md
│  ├─ desktop.md
│  ├─ mobile.md
│  ├─ maui.md
│  ├─ shared-contract.md
│  ├─ web.md
│  └─ docker.md
└─ README.md
```

This layout intentionally keeps platform-specific code out of shared packages. The web app can run without Electron, while desktop, Expo, and MAUI shells add platform-specific behavior at the edge.
