# Mobile

The mobile app lives in `apps/mobile` and uses Expo + React Native.

Responsibilities:

- mobile dashboard
- dataset list
- worker job overview
- report list
- shared domain model from `@enterprise-analytics/core`

Development:

```bash
npm run dev:mobile
```

Platform commands:

```bash
npm --workspace @enterprise-analytics/mobile run android
npm --workspace @enterprise-analytics/mobile run ios
```

The first version uses the shared demo dashboard snapshot. A later production version can connect to a backend API, offline sync layer, or secure mobile storage.
