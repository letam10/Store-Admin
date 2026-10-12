#Requires -Version 5.1
<#
.SYNOPSIS
  Dung database StoreDb cho may moi pull ve (nhom 3 nguoi) - chay 1 lan la du.
.DESCRIPTION
  1. Kiem tra SQL Server (MSSQLSERVER) dang Running.
  2. Tao database StoreDb neu chua co (ket noi master, dung -C de qua loi chung chi self-signed).
  3. Chay schema-mssql.sql de tao du tables + seed san pham mau.
  4. dotnet restore de san sang chay API cong 5000.
.EXAMPLE
  powershell ./scripts/setup-db.ps1
  powershell ./scripts/setup-db.ps1 -SqlInstance "localhost\SQLEXPRESS"
#>
param(
  [string]$SqlInstance = $env:SQL_SERVER,
  [string]$Database = $env:SQL_DATABASE,
  [string]$SchemaFile = ""
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($SqlInstance)) { $SqlInstance = 'localhost' }
if ([string]::IsNullOrWhiteSpace($Database)) { $Database = 'StoreDb' }

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$DotnetDir = Split-Path -Parent $ScriptDir
$RepoRoot = Split-Path -Parent $DotnetDir

# Uu tien schema di kem server-dotnet, fallback sang backend Node cu.
$Candidates = @()
if (-not [string]::IsNullOrWhiteSpace($SchemaFile)) { $Candidates += $SchemaFile }
$Candidates += (Join-Path $ScriptDir 'init-db.sql')
$Candidates += (Join-Path $RepoRoot 'server\data\schema-mssql.sql')
$ResolvedSchema = $Candidates | Where-Object { -not [string]::IsNullOrWhiteSpace($_) -and (Test-Path $_) } | Select-Object -First 1

Write-Host '=== StoreDb setup (1-click cho may moi) ===' -ForegroundColor Cyan
Write-Host "SQL instance : $SqlInstance"
Write-Host "Database     : $Database"
if ($ResolvedSchema) {
  Write-Host "Schema file  : $ResolvedSchema"
} else {
  Write-Host "Schema file  : (khong thay - se nho API tu tao)"
}

# 1. Kiem tra sqlcmd
try {
  $null = Get-Command sqlcmd -ErrorAction Stop
} catch {
  Write-Host 'Chua co sqlcmd. Hay cai SQL Server + sqlcmd roi chay lai.' -ForegroundColor Red
  Write-Host 'Tai SQL Express: https://www.microsoft.com/sql-server/sql-server-downloads' -ForegroundColor Yellow
  exit 1
}

# 2. Kiem tra service SQL Server
try {
  $svc = Get-Service MSSQL* -ErrorAction SilentlyContinue | Select-Object -First 1
  if (($null -ne $svc) -and ($svc.Status -ne 'Running')) {
    Write-Host ("Service " + $svc.Name + " dang " + $svc.Status + " - dang thu Start...") -ForegroundColor Yellow
    Start-Service $svc.Name -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 3
  }
} catch {
  Write-Host 'Khong kiem tra duoc service SQL Server (bo qua).' -ForegroundColor Yellow
}

function Invoke-StoreSql([string]$Query, [string]$DbName = '') {
  $sqlArgs = @('-S', $SqlInstance, '-C', '-Q', $Query)
  if (-not [string]::IsNullOrWhiteSpace($DbName)) { $sqlArgs += @('-d', $DbName) }
  & sqlcmd @sqlArgs
  if ($LASTEXITCODE -ne 0) { throw ("sqlcmd that bai (exit " + $LASTEXITCODE + "): " + $Query) }
}

# 3. Tao database neu chua co
Write-Host ''
Write-Host '[1/3] Tao database neu chua co...' -ForegroundColor Green
Invoke-StoreSql "IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'$Database') CREATE DATABASE [$Database];"

# 4. Chay schema day du
Write-Host '[2/3] Tao tables + seed du lieu mau...' -ForegroundColor Green
if ($ResolvedSchema) {
  & sqlcmd -S $SqlInstance -C -d $Database -i $ResolvedSchema
  if ($LASTEXITCODE -ne 0) {
    Write-Host 'Chay schema file bao loi - API van se tu tao tables khi khoi dong.' -ForegroundColor Yellow
  } else {
    Write-Host 'Da chay schema xong.' -ForegroundColor Green
  }
} else {
  Write-Host 'Khong thay schema-mssql.sql - bo qua, API se tu tao tables + seed khi chay.' -ForegroundColor Yellow
}

# 5. dotnet restore
Write-Host '[3/3] dotnet restore...' -ForegroundColor Green
Push-Location $DotnetDir
try {
  $ProjFile = Join-Path $DotnetDir 'server-dotnet.csproj'
  if (Test-Path $ProjFile) {
    & dotnet restore $ProjFile
  } else {
    & dotnet restore
  }
  if ($LASTEXITCODE -ne 0) { throw ("dotnet restore that bai (exit " + $LASTEXITCODE + ")") }
} finally {
  Pop-Location
}

Write-Host ''
Write-Host 'Xong! Gio chay API:' -ForegroundColor Green
Write-Host '   cd server-dotnet; dotnet run --urls http://127.0.0.1:5000' -ForegroundColor White
Write-Host '   Kiem tra: http://127.0.0.1:5000/swagger  va  http://127.0.0.1:5000/api/health/db' -ForegroundColor White

