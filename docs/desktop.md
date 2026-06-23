# Desktop

The desktop app is an Electron shell in `apps/desktop`.

Responsibilities:

- create the native window
- expose a safe preload bridge
- own SQLite database access
- seed demo workspace metadata
- load the React app from the web package in development

Runtime path:

```text
Electron main
  -> workspace repository
  -> SQLite database
  -> preload bridge
  -> React dashboard
```

Development:

```bash
npm run dev:desktop
```

The desktop app stores the local SQLite file at Electron's `userData` path as `workspace.sqlite3`.
