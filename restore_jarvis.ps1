param(
  [Parameter(Mandatory = $true)]
  [string]$BackupPath,
  [string]$Destination,
  [switch]$ImportWorkflow
)

$ErrorActionPreference = "Stop"

$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ResolvedBackup = (Resolve-Path -LiteralPath $BackupPath).Path
if (-not $Destination) {
  $Name = [IO.Path]::GetFileNameWithoutExtension($ResolvedBackup)
  $Destination = Join-Path $ProjectDir "restored\$Name"
}

$ResolvedDestination = [IO.Path]::GetFullPath($Destination)
if (Test-Path -LiteralPath $ResolvedDestination) {
  throw "A pasta de destino ja existe: $ResolvedDestination"
}

New-Item -ItemType Directory -Path $ResolvedDestination -Force | Out-Null
Expand-Archive -LiteralPath $ResolvedBackup -DestinationPath $ResolvedDestination

$ManifestPath = Join-Path $ResolvedDestination "manifest.json"
if (-not (Test-Path -LiteralPath $ManifestPath)) {
  throw "Backup invalido: manifest.json nao encontrado."
}

$Manifest = Get-Content -LiteralPath $ManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
foreach ($File in $Manifest.files) {
  $Path = Join-Path $ResolvedDestination ($File.path.Replace("/", "\"))
  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Arquivo ausente no backup: $($File.path)"
  }
  $Hash = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash
  if ($Hash -ne $File.sha256) {
    throw "Falha de integridade: $($File.path)"
  }
}

Write-Host "Backup verificado e extraido em: $ResolvedDestination"
Write-Host "O projeto atual nao foi sobrescrito."

if ($ImportWorkflow) {
  $WorkflowFile = Join-Path $ResolvedDestination "n8n\published-workflows.json"
  if (-not (Test-Path -LiteralPath $WorkflowFile)) {
    throw "Workflow exportado nao encontrado."
  }
  & docker cp $WorkflowFile "jarvis-n8n:/tmp/jarvis-restore-workflows.json" | Out-Null
  & docker exec jarvis-n8n n8n import:workflow --input=/tmp/jarvis-restore-workflows.json
  if ($LASTEXITCODE -ne 0) {
    throw "Falha ao importar o workflow. Nenhuma credencial secreta foi restaurada."
  }
  Write-Host "Workflow importado. Revise as credenciais no n8n antes de publicar."
}
