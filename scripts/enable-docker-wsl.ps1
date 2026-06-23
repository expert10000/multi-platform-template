$ErrorActionPreference = "Stop"

Write-Host "Enabling Windows features required by Docker Desktop WSL backend..."

dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart

Write-Host ""
Write-Host "Installing WSL support without a default Linux distribution..."
wsl.exe --install --no-distribution

Write-Host ""
Write-Host "Docker Desktop prerequisites were requested."
Write-Host "Restart Windows before starting Docker Desktop again."
