$ErrorActionPreference = "Stop"

$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectDir

$Connection = Get-NetTCPConnection -LocalPort 8787 -State Listen -ErrorAction SilentlyContinue |
  Select-Object -First 1

if ($Connection) {
  Stop-Process -Id $Connection.OwningProcess -Force
  Write-Host "Servidor do Jarvis desligado."
} else {
  Write-Host "Servidor do Jarvis ja estava desligado."
}

try {
  & docker compose stop
  if ($LASTEXITCODE -eq 0) {
    Write-Host "n8n desligado."
  }
} catch {
  Write-Warning "Docker nao estava disponivel para desligar o n8n."
}

Write-Host "Jarvis desligado. O Docker Desktop pode permanecer aberto."
