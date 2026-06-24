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

Linux packages:

```bash
npm run package:desktop:linux
```

This writes `.AppImage`, `.deb`, and `.rpm` packages to `release/desktop`.

Because the desktop app uses SQLite through a native Node module, build Linux packages on Linux or inside Docker so `better-sqlite3` is compiled for Linux:

```bash
npm run docker:desktop:linux:build
docker run --rm -v "${PWD}/release/desktop-linux:/workspace/release/desktop" enterprise-analytics-desktop-linux
```

Desktop icon:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/generate-desktop-icon.ps1
```

The source mark lives at `apps/desktop/assets/icon.svg`; the Windows installer uses `apps/desktop/assets/icon.ico`.
