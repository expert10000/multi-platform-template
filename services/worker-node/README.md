# Node Worker

The Node worker covers JavaScript-native workspace workflow jobs.

Use it for:

- CSV import previews.
- Data validation.
- Lightweight transformations.
- Notifications.
- Email draft generation.

These jobs are useful for JavaScript-focused readers because they use familiar Node tooling while sharing the same worker contract as the Python analytics worker.

## Examples

Build:

```bash
npm --workspace @enterprise-analytics/worker-api-contract run build
npm --workspace @enterprise-analytics/worker-node run build
```

Run a CSV import preview:

```bash
npm run worker:node:import
```

Run validation:

```bash
npm run worker:node:validate
```

Generate an email draft:

```bash
npm run worker:node:email
```
