$ErrorActionPreference = "Stop"

$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Node = "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

if (-not (Test-Path -LiteralPath $Node)) {
  $Node = (Get-Command node -ErrorAction Stop).Source
}

Set-Location $ProjectDir

if (-not (Test-Path -LiteralPath ".\node_modules\vite\bin\vite.js")) {
  throw "Dependencias do frontend nao encontradas. Execute a instalacao npm antes de compilar."
}

& $Node ".\node_modules\typescript\bin\tsc" --noEmit
if ($LASTEXITCODE -ne 0) {
  throw "A validacao TypeScript falhou."
}

& $Node ".\node_modules\vite\bin\vite.js" build
if ($LASTEXITCODE -ne 0) {
  throw "O build do frontend falhou."
}

Write-Host "Frontend compilado em: $ProjectDir\dist"
