$ErrorActionPreference = "Stop"

$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PythonCandidates = @(
  "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe",
  "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe",
  "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe",
  "$env:LOCALAPPDATA\Programs\Python\Python310\python.exe",
  "python",
  "py"
)

$Python = $null
foreach ($Candidate in $PythonCandidates) {
  try {
    $Command = Get-Command $Candidate -ErrorAction Stop
    $Python = $Command.Source
    break
  } catch {
    if (Test-Path $Candidate) {
      $Python = $Candidate
      break
    }
  }
}

if (-not $Python) {
  throw "Python nao encontrado. Instale Python 3.10+ ou rode jarvis_server.py com o Python do seu sistema."
}

Set-Location $ProjectDir

$DockerDesktop = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
$DockerReady = $false

try {
  & docker info *> $null
  $DockerReady = $LASTEXITCODE -eq 0
} catch {
  $DockerReady = $false
}

if (-not $DockerReady) {
  if (-not (Test-Path -LiteralPath $DockerDesktop)) {
    throw "Docker Desktop nao encontrado."
  }

  Write-Host "Iniciando Docker Desktop..."
  Start-Process -FilePath $DockerDesktop

  for ($Attempt = 1; $Attempt -le 60; $Attempt++) {
    Start-Sleep -Seconds 2
    try {
      & docker info *> $null
      if ($LASTEXITCODE -eq 0) {
        $DockerReady = $true
        break
      }
    } catch {
      $DockerReady = $false
    }
  }
}

if (-not $DockerReady) {
  throw "Docker Desktop nao ficou pronto a tempo."
}

Write-Host "Iniciando n8n..."
& docker compose up -d
if ($LASTEXITCODE -ne 0) {
  throw "Nao foi possivel iniciar o n8n."
}

try {
  & "$ProjectDir\backup_jarvis.ps1" -Quiet
} catch {
  Write-Warning "Nao foi possivel criar o backup automatico: $($_.Exception.Message)"
}

$ExistingServer = Get-NetTCPConnection -LocalPort 8787 -State Listen -ErrorAction SilentlyContinue |
  Select-Object -First 1
if ($ExistingServer) {
  Write-Host "Jarvis ja esta ligado em http://127.0.0.1:8787"
  Start-Process "http://127.0.0.1:8787"
  return
}

Write-Host "Abrindo Jarvis em http://127.0.0.1:8787"
Start-Process -FilePath $Python -ArgumentList "jarvis_server.py" -WorkingDirectory $ProjectDir -WindowStyle Hidden

$JarvisReady = $false
for ($Attempt = 1; $Attempt -le 30; $Attempt++) {
  Start-Sleep -Milliseconds 500
  try {
    $Response = Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:8787/" -TimeoutSec 2
    if ($Response.StatusCode -eq 200) {
      $JarvisReady = $true
      break
    }
  } catch {
    $JarvisReady = $false
  }
}

if (-not $JarvisReady) {
  throw "O servidor do Jarvis nao respondeu a tempo."
}

Start-Process "http://127.0.0.1:8787"
Write-Host "Jarvis ligado. Esta janela pode ser fechada."
