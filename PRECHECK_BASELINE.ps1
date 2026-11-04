param(
 [Parameter(Mandatory=$true)][string]$RepoPath
)
$ErrorActionPreference = 'Stop'
$packageRoot = $PSScriptRoot
$repo = (Resolve-Path -LiteralPath $RepoPath).Path
if (-not (Test-Path -LiteralPath (Join-Path $repo '.git'))) { throw "La ruta no es un repositorio Git: $repo" }
$package = Get-Content -LiteralPath (Join-Path $repo 'package.json') -Raw | ConvertFrom-Json
if ($package.name -ne 'production-control') { throw "El package.json no pertenece a production-control" }
$records = Import-Csv -LiteralPath (Join-Path $packageRoot 'MANIFEST_BASELINE_SHA256.csv')
$problems = @()
foreach ($r in $records) {
 $target = Join-Path $repo ($r.Path -replace '/', [IO.Path]::DirectorySeparatorChar)
 if (-not (Test-Path -LiteralPath $target)) { $problems += "FALTA: $($r.Path)"; continue }
 $actual = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant()
 if ($actual -ne $r.SHA256_Original.ToLowerInvariant()) {
  $problems += "DIFIERE: $($r.Path) | repo: $actual | baseline: $($r.SHA256_Original)"
 }
}
if ($problems.Count -gt 0) {
 Write-Host "NO INSTALAR: el repositorio difiere de production-control copy(9).zip" -ForegroundColor Yellow
 $problems | ForEach-Object { Write-Host $_ -ForegroundColor Red }
 exit 1
}
Write-Host "OK: 9 archivos del repo coinciden con la baseline enviada." -ForegroundColor Green
Write-Host "Revisa git status antes de copiar. El chequeo es de solo lectura."
