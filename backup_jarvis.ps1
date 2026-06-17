param(
  [switch]$Force,
  [switch]$Quiet,
  [int]$Retention = 7,
  [int]$MinIntervalHours = 20
)

$ErrorActionPreference = "Stop"

$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackupDir = Join-Path $ProjectDir "backups"
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$StagingDir = Join-Path $BackupDir ".staging-$Timestamp"
$ArchivePath = Join-Path $BackupDir "jarvis-backup-$Timestamp.zip"

New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null

if (-not $Force) {
  $Latest = Get-ChildItem -LiteralPath $BackupDir -Filter "jarvis-backup-*.zip" -File |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
  if ($Latest -and $Latest.LastWriteTime -gt (Get-Date).AddHours(-$MinIntervalHours)) {
    if (-not $Quiet) {
      Write-Host "Backup recente encontrado: $($Latest.Name)"
    }
    return
  }
}

try {
  New-Item -ItemType Directory -Path $StagingDir -Force | Out-Null
  $ProjectBackup = Join-Path $StagingDir "project"
  $MemoryBackup = Join-Path $StagingDir "memory"
  $WorkflowBackup = Join-Path $StagingDir "n8n"
  New-Item -ItemType Directory -Path $ProjectBackup, $MemoryBackup, $WorkflowBackup -Force | Out-Null

  $ProjectFiles = @(
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "vite.config.ts",
    "app.js",
    "index.html",
    "styles.css",
    "jarvis_server.py",
    "jarvis_pc.py",
    "start_jarvis.ps1",
    "stop_jarvis.ps1",
    "Ligar Jarvis.cmd",
    "Desligar Jarvis.cmd",
    "backup_jarvis.ps1",
    "build_frontend.ps1",
    "restore_jarvis.ps1",
    "smoke_test_app.mjs",
    "docker-compose.yml",
    "requirements.txt",
    ".env.example",
    "n8n-workflow-template.json",
    "README.md",
    "BACKUP.md",
    "arquitetura-n8n.md",
    "integracoes-e-permissoes.md",
    "personalidade.md",
    "prompt_sistema.md",
    "tts-webhook.md"
  )

  foreach ($Name in $ProjectFiles) {
    $Source = Join-Path $ProjectDir $Name
    if (Test-Path -LiteralPath $Source) {
      Copy-Item -LiteralPath $Source -Destination (Join-Path $ProjectBackup $Name) -Force
    }
  }

  foreach ($DirectoryName in @("src", "dist")) {
    $SourceDirectory = Join-Path $ProjectDir $DirectoryName
    if (Test-Path -LiteralPath $SourceDirectory) {
      Copy-Item -LiteralPath $SourceDirectory -Destination (Join-Path $ProjectBackup $DirectoryName) -Recurse -Force
    }
  }

  $MemoryDir = Join-Path $ProjectDir "memoria-obsidian"
  if (Test-Path -LiteralPath $MemoryDir) {
    Get-ChildItem -LiteralPath $MemoryDir -File |
      Where-Object { $_.Name -notlike "*.tmp" } |
      Copy-Item -Destination $MemoryBackup -Force
  }

  $ContainerExport = "/tmp/jarvis-backup-$Timestamp.json"
  & docker exec jarvis-n8n n8n export:workflow --all --published --pretty --output=$ContainerExport | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "Falha ao exportar workflows do n8n."
  }

  $WorkflowFile = Join-Path $WorkflowBackup "published-workflows.json"
  & docker cp "jarvis-n8n:$ContainerExport" $WorkflowFile | Out-Null
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $WorkflowFile)) {
    throw "Falha ao copiar o workflow exportado."
  }

  $EnvKeys = @()
  $EnvFile = Join-Path $ProjectDir ".env"
  if (Test-Path -LiteralPath $EnvFile) {
    foreach ($Line in Get-Content -LiteralPath $EnvFile -Encoding UTF8) {
      if ($Line -match "^\s*([^#][^=]*)=") {
        $EnvKeys += $Matches[1].TrimStart([char]0xFEFF).Trim()
      }
    }
  }

  $Files = Get-ChildItem -LiteralPath $StagingDir -Recurse -File
  $Manifest = [ordered]@{
    formatVersion = 1
    createdAt = (Get-Date).ToString("o")
    project = "Jarvis 2.0"
    security = @{
      envIncluded = $false
      credentialSecretsIncluded = $false
      note = "O export do n8n contem referencias de credenciais, mas nao contem tokens OAuth nem segredos."
    }
    requiredEnvironmentKeys = $EnvKeys
    files = @(
      $Files | ForEach-Object {
        [ordered]@{
          path = $_.FullName.Substring($StagingDir.Length + 1).Replace("\", "/")
          size = $_.Length
          sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash
        }
      }
    )
  }
  $Manifest | ConvertTo-Json -Depth 6 |
    Set-Content -LiteralPath (Join-Path $StagingDir "manifest.json") -Encoding UTF8

  Compress-Archive -Path (Join-Path $StagingDir "*") -DestinationPath $ArchivePath -CompressionLevel Optimal

  Get-ChildItem -LiteralPath $BackupDir -Filter "jarvis-backup-*.zip" -File |
    Sort-Object LastWriteTime -Descending |
    Select-Object -Skip ([Math]::Max(1, $Retention)) |
    Remove-Item -Force

  if (-not $Quiet) {
    Write-Host "Backup criado: $ArchivePath"
  }
} finally {
  if (Test-Path -LiteralPath $StagingDir) {
    Remove-Item -LiteralPath $StagingDir -Recurse -Force
  }
}
