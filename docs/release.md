# Release

Official desktop packages are built by GitHub Actions when a version tag is pushed.

```bash
git tag v0.1.0
git push origin v0.1.0
```

The `Desktop Release` workflow builds and attaches these assets to the GitHub Release:

- Windows NSIS installer: `.exe`
- Ubuntu/Debian package: `.deb`
- Fedora/RHEL package: `.rpm`
- Portable Linux package: `.AppImage`

Linux packages are built on GitHub's Ubuntu runner so the bundled SQLite native module is compiled for Linux. Windows packages are built on GitHub's Windows runner.
