# Mobile

The mobile app lives in `apps/mobile` and uses Expo + React Native.

Responsibilities:

- mobile dashboard
- dataset list
- worker job overview
- report list
- shared domain model from `@enterprise-analytics/core`
- future local or remote workspace server integration

Development:

```bash
npm run dev:mobile
```

Platform commands:

```bash
npm --workspace @enterprise-analytics/mobile run android
npm --workspace @enterprise-analytics/mobile run ios
```

The first version uses the shared demo dashboard snapshot. A production version can connect to the same OpenAPI contract served by `services/workspace-server`, a remote backend API, an offline sync layer, or secure mobile storage.

## .NET MAUI Alternative

The repo also includes `apps/maui` for a native .NET MAUI shell.

Use it when the target audience wants a C# and XAML cross-platform path for Windows, Android, iOS, and Mac Catalyst:

```bash
npm run restore:maui
npm run dev:maui
```

The default npm build does not include MAUI because it requires .NET MAUI workloads on the developer machine or CI runner.
