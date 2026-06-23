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
    "path": "sample-data/real/superstore-sales/train.csv",
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

Supported job kinds:

- Python: `sales.kpi`, `sales.forecast`, `csv.process`, `report.pdf`
- Node: `csv.import`, `data.validate`, `data.transform`, `notification.create`, `email.generate`
