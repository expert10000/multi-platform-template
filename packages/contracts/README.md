# Worker API Contract

Shared contract for worker job requests and results.

The template intentionally has two worker runtimes:

- `worker-python` for analytical jobs.
- `worker-node` for JavaScript-native workflow jobs.

Both should speak the same high-level shape:

```json
{
  "id": "job-001",
  "kind": "csv.import",
  "runtime": "node",
  "input": {
    "path": "data/sample/real/superstore-sales/train.csv",
    "mediaType": "text/csv"
  },
  "output": {
    "path": "reports/csv-import-summary.json",
    "mediaType": "application/json"
  },
  "params": {},
  "requestedAt": "2026-06-23T00:00:00.000Z"
}
```

The local Workspace Server currently queues these Python job kinds over HTTP when `params.datasetId` names an imported or sample sales dataset:

- `sales.kpi` → JSON KPI report
- `sales.forecast` → JSON trend and forecast report
- `report.html` → browser-readable HTML report

The wider worker protocol also names job kinds for future integrations and command-line worker use:

- Python: `csv.process`, `report.pdf`
- Node: `csv.import`, `data.validate`, `data.transform`, `notification.create`, `email.generate`
