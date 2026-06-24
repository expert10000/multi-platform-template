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

Windows installer:

```bash
npm run package:desktop:win
```

The setup program is written to `release/desktop/Enterprise Analytics Workspace Setup 0.1.0.exe`.

Desktop icon:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/generate-desktop-icon.ps1
```

The source mark lives at `apps/desktop/assets/icon.svg`; the Windows installer uses `apps/desktop/assets/icon.ico`.
