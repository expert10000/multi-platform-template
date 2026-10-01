# Mobile App

Expo/React Native mobile shell for the Enterprise Platform.

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

The app fetches `GET /api/dashboard/snapshot` from the Workspace Server and shows generated reports from that server. It uses the shared `@enterprise-analytics/core` snapshot only when the API is unreachable. Use the refresh button to retry.

Android emulators use `http://10.0.2.2:8797/api` by default; iOS simulators use `http://127.0.0.1:8797/api`. For a physical device, set `EXPO_PUBLIC_WORKSPACE_API_URL` to a server URL reachable from that device before starting Expo. The Workspace Server has no authentication, so use a trusted development network for this configuration.
