# Mobile App

Expo/React Native mobile shell for the Enterprise Analytics Workspace.

It mirrors the same information architecture as desktop and web:

- Dashboard
- Datasets
- Jobs
- Reports

Run:

```bash
npm run dev:mobile
```

Open on Android:

```bash
npm --workspace @enterprise-analytics/mobile run android
```

Open on iOS:

```bash
npm --workspace @enterprise-analytics/mobile run ios
```

The starter app uses the shared `@enterprise-analytics/core` dashboard snapshot. Later, it can call a web API or local sync layer instead of reading demo data directly.
