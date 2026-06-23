# Docker

The Docker setup demonstrates both the static web app and worker runtimes.

## Web App

Build the web image:

```bash
npm run docker:web:build
```

Run it:

```bash
npm run docker:web:run
```

Open:

```text
http://127.0.0.1:8080
```

## Compose

Run the web app and worker demo with Compose:

```bash
npm run docker:compose
```

The web app is exposed at:

```text
http://127.0.0.1:8080
```

## Python Worker

Build and run a KPI demo:

```bash
docker compose -f docker/docker-compose.yml up --build
```

The container reads:

```text
sample-data/online-retail.csv
```

and writes:

```text
reports/kpi-analysis.json
```

The Docker image is intentionally worker-only. Electron and the local SQLite database remain desktop concerns.
