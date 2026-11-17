#Requires -Version 5.1
<#
.SYNOPSIS
  Store / Store-Admin - Database Sync Tool (SQL Server).
.DESCRIPTION
  Cong cu dong bo CSDL cho nhom du an Store:
  - EXPORT : Xuat schema + toan bo data hien tai ra 'seed-data.sql' de commit & push Git.
  - SYNC   : Nguoi khac pull ve chay script: tu tao DB neu chua co, dong bo ban ghi neu da co.
  - RESET  : Xoa tao lai DB trang & nap 100% tu file Git.
  - STATUS : Xem trang thai ket noi va so luong ban ghi.
.EXAMPLE
  .\sync-db.ps1                   # Menu tuong tac
  .\sync-db.ps1 -Action Export    # Xuat du lieu ra file de push Git
  .\sync-db.ps1 -Action Sync      # Dong bo du lieu tu file Git vao may nay
  .\sync-db.ps1 -Action Reset     # Xoa va tao lai DB moi
  .\sync-db.ps1 -Action Status    # Xem so luong ban ghi
#>
[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet('Export', 'Sync', 'Import', 'Reset', 'Status', '')]
    [string]$Action = '',

    [string]$SqlInstance = '',
    [string]$Database = 'StoreDb',
    [string]$DataFile = ''
)

$ErrorActionPreference = 'Stop'

# Xac dinh thu muc du an
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (Test-Path (Join-Path $ScriptDir 'Store-Admin\server-dotnet')) {
    $DotnetDir = Join-Path $ScriptDir 'Store-Admin\server-dotnet'
} elseif (Test-Path (Join-Path $ScriptDir 'server-dotnet')) {
    $DotnetDir = Join-Path $ScriptDir 'server-dotnet'
} else {
    $DotnetDir = $ScriptDir
}

$ScriptsDir = Join-Path $DotnetDir 'scripts'
if (-not (Test-Path $ScriptsDir)) {
    New-Item -ItemType Directory -Path $ScriptsDir -Force | Out-Null
}

$SchemaFile = Join-Path $ScriptsDir 'init-db.sql'
if ([string]::IsNullOrWhiteSpace($DataFile)) {
    $DataFile = Join-Path $ScriptsDir 'seed-data.sql'
}

$script:ResolvedServer = $null

function Test-SqlConnection([string]$connStr) {
    try {
        $conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
        $conn.Open()
        $conn.Close()
        return $true
    } catch {
        return $false
    }
}

function Get-DatabaseServer() {
    if ($script:ResolvedServer) {
        return $script:ResolvedServer
    }

    if (-not [string]::IsNullOrWhiteSpace($SqlInstance)) {
        $script:ResolvedServer = $SqlInstance
        return $script:ResolvedServer
    }

    # 1. Thu doc tu .env
    $envFile = Join-Path $DotnetDir '.env'
    if (Test-Path $envFile) {
        $line = Get-Content $envFile | Where-Object { $_ -match '^ConnectionStrings__StoreDb=(.+)$' } | Select-Object -First 1
        if ($line -and ($line -match 'Server=([^;]+)')) {
            $candidate = $matches[1].Trim()
            if (Test-SqlConnection "Server=$candidate;Database=master;Integrated Security=True;TrustServerCertificate=True;Encrypt=False;") {
                $script:ResolvedServer = $candidate
                return $candidate
            }
        }
    }

    # 2. Thu doc tu appsettings.json
    $appFile = Join-Path $DotnetDir 'appsettings.json'
    if (Test-Path $appFile) {
        try {
            $appJson = Get-Content $appFile -Raw | ConvertFrom-Json
            $rawCs = $appJson.ConnectionStrings.StoreDb
            if ($rawCs -and ($rawCs -match 'Server=([^;]+)')) {
                $candidate = $matches[1].Trim()
                if (Test-SqlConnection "Server=$candidate;Database=master;Integrated Security=True;TrustServerCertificate=True;Encrypt=False;") {
                    $script:ResolvedServer = $candidate
                    return $candidate
                }
            }
        } catch {}
    }

    # 3. Thu cac instance SQL Server pho bien tren may cuc bo
    $candidates = @('(localdb)\mssqllocaldb', 'localhost', '.\SQLEXPRESS', '127.0.0.1')
    foreach ($c in $candidates) {
        if (Test-SqlConnection "Server=$c;Database=master;Integrated Security=True;TrustServerCertificate=True;Encrypt=False;") {
            $script:ResolvedServer = $c
            return $c
        }
    }

    $fallback = '(localdb)\mssqllocaldb'
    $script:ResolvedServer = $fallback
    return $fallback
}

function Get-ConnectionString([string]$TargetDb = '') {
    $server = Get-DatabaseServer
    $dbName = $(if (-not [string]::IsNullOrWhiteSpace($TargetDb)) { $TargetDb } else { $Database })

    if ([string]::IsNullOrWhiteSpace($TargetDb)) {
        $envFile = Join-Path $DotnetDir '.env'
        $foundInEnv = $false
        if (Test-Path $envFile) {
            $line = Get-Content $envFile | Where-Object { $_ -match '^ConnectionStrings__StoreDb=(.+)$' } | Select-Object -First 1
            if ($line -and ($line -match 'Database=([^;]+)')) {
                $dbName = $matches[1].Trim()
                $foundInEnv = $true
            }
        }
        if (-not $foundInEnv) {
            $appFile = Join-Path $DotnetDir 'appsettings.json'
            if (Test-Path $appFile) {
                try {
                    $appJson = Get-Content $appFile -Raw | ConvertFrom-Json
                    $rawCs = $appJson.ConnectionStrings.StoreDb
                    if ($rawCs -and ($rawCs -match 'Database=([^;]+)')) {
                        $dbName = $matches[1].Trim()
                    }
                } catch {}
            }
        }
    }

    return "Server=$server;Database=$dbName;Integrated Security=True;TrustServerCertificate=True;Encrypt=False;MultipleActiveResultSets=True;"
}

function Format-SqlValue($val, [string]$dataType) {
    if ($null -eq $val -or [System.DBNull]::Value.Equals($val)) {
        return "NULL"
    }
    if ($val -is [bool]) {
        if ($val) { return "1" } else { return "0" }
    }
    if ($val -is [byte] -or $val -is [int16] -or $val -is [int32] -or $val -is [int64] -or $val -is [decimal] -or $val -is [double] -or $val -is [single]) {
        return "$val"
    }
    if ($val -is [System.DateTimeOffset]) {
        return "N'$($val.ToString('o'))'"
    }
    if ($val -is [System.DateTime]) {
        return "N'$($val.ToString('yyyy-MM-ddTHH:mm:ss.fff'))'"
    }
    if ($val -is [byte[]]) {
        $hex = [System.BitConverter]::ToString($val).Replace('-', '')
        return "0x$hex"
    }
    $strVal = "$val".Replace("'", "''")
    return "N'$strVal'"
}

function Export-Database() {
    Write-Host "`n>>> [EXPORT] Dang doc du lieu tu database '$Database'..." -ForegroundColor Cyan
    $connStr = Get-ConnectionString
    if (-not (Test-SqlConnection $connStr)) {
        Write-Host "Loi: Khong the ket noi toi '$Database'. Hay chac chan SQL Server dang chay!" -ForegroundColor Red
        return
    }

    $conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
    $conn.Open()

    $tablesToExport = @(
        'admins',
        'settings',
        'catalog_products',
        'Products',
        'voucher_codes',
        'customers',
        'customer_vouchers',
        'customer_favorites',
        'product_reviews',
        'product_views',
        'customer_orders',
        'admin_records',
        'checkout_intents',
        'bank_payment_receipts',
        'sepay_transactions',
        'checkout_unmatched_payments',
        'after_sales_refunds',
        'admin_events',
        'notification_outbox',
        'conversations',
        'messages',
        'chat_turns'
    )

    $identityCols = @{}
    $identCmd = $conn.CreateCommand()
    $identCmd.CommandText = "SELECT t.name AS TableName, c.name AS ColName FROM sys.identity_columns c INNER JOIN sys.tables t ON c.object_id = t.object_id;"
    $r = $identCmd.ExecuteReader()
    while ($r.Read()) {
        $identityCols[$r['TableName']] = $r['ColName']
    }
    $r.Close()

    $pkCols = @{}
    $pkCmd = $conn.CreateCommand()
    $pkCmd.CommandText = @"
SELECT t.name AS TableName, c.name AS ColName 
FROM sys.indexes i
INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
INNER JOIN sys.tables t ON i.object_id = t.object_id
WHERE i.is_primary_key = 1
ORDER BY t.name, ic.key_ordinal;
"@
    $r = $pkCmd.ExecuteReader()
    while ($r.Read()) {
        $t = $r['TableName']
        if (-not $pkCols.ContainsKey($t)) { $pkCols[$t] = @() }
        $pkCols[$t] += $r['ColName']
    }
    $r.Close()

    $uniqueCols = @{}
    $uqCmd = $conn.CreateCommand()
    $uqCmd.CommandText = @"
SELECT t.name AS TableName, c.name AS ColName 
FROM sys.indexes i
INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
INNER JOIN sys.tables t ON i.object_id = t.object_id
WHERE i.is_unique = 1 AND i.is_primary_key = 0
ORDER BY t.name, i.index_id, ic.key_ordinal;
"@
    $r = $uqCmd.ExecuteReader()
    while ($r.Read()) {
        $t = $r['TableName']
        if (-not $uniqueCols.ContainsKey($t)) { $uniqueCols[$t] = @() }
        $uniqueCols[$t] += $r['ColName']
    }
    $r.Close()

    $sb = New-Object System.Text.StringBuilder
    $null = $sb.AppendLine("-- =========================================================")
    $null = $sb.AppendLine("-- Store & Store-Admin - Database Seed / Sync Data")
    $null = $sb.AppendLine("-- Exported on: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
    $null = $sb.AppendLine("-- =========================================================")
    $null = $sb.AppendLine("USE [$Database];")
    $null = $sb.AppendLine("GO`n")
    $null = $sb.AppendLine("-- Tam thoi tat kiem tra khoa ngoai de nap du lieu an toan")
    $null = $sb.AppendLine("EXEC sp_MSforeachtable 'ALTER TABLE ? NOCHECK CONSTRAINT ALL';")
    $null = $sb.AppendLine("GO`n")

    $totalExportedRows = 0

    foreach ($table in $tablesToExport) {
        $chkCmd = $conn.CreateCommand()
        $chkCmd.CommandText = "SELECT COUNT(*) FROM sys.tables WHERE name = '$table';"
        $tableExists = ($chkCmd.ExecuteScalar() -gt 0)
        if (-not $tableExists) { continue }

        $cmd = $conn.CreateCommand()
        $cmd.CommandText = "SELECT * FROM [$table];"
        $adapter = New-Object System.Data.SqlClient.SqlDataAdapter($cmd)
        $dt = New-Object System.Data.DataTable
        $adapter.Fill($dt) | Out-Null

        $rowCount = $dt.Rows.Count
        if ($rowCount -eq 0) { continue }

        $totalExportedRows += $rowCount
        Write-Host "  -> Bang [$table]: $rowCount ban ghi" -ForegroundColor Green

        $hasIdentity = $identityCols.ContainsKey($table)
        $primaryKeys = $(if ($pkCols.ContainsKey($table)) { $pkCols[$table] } else { @($dt.Columns[0].ColumnName) })

        $colNames = @($dt.Columns | ForEach-Object { $_.ColumnName })
        $colListSql = ($colNames | ForEach-Object { "[$_]" }) -join ', '
        $srcColListSql = ($colNames | ForEach-Object { "src.[$_]" }) -join ', '

        $null = $sb.AppendLine("-- Table: $table ($rowCount rows)")
        if ($hasIdentity) {
            $null = $sb.AppendLine("SET IDENTITY_INSERT [$table] ON;")
        }

        $batchSize = 500
        for ($i = 0; $i -lt $rowCount; $i += $batchSize) {
            $currentBatchCount = [Math]::Min($batchSize, $rowCount - $i)
            $valueRows = @()

            for ($j = 0; $j -lt $currentBatchCount; $j++) {
                $row = $dt.Rows[$i + $j]
                $valStrs = @()
                foreach ($col in $dt.Columns) {
                    $valStrs += (Format-SqlValue $row[$col.ColumnName] $col.DataType.Name)
                }
                $valueRows += "  (" + ($valStrs -join ', ') + ")"
            }

            $condList = @(@($primaryKeys | ForEach-Object { "target.[$_] = src.[$_]" }) -join ' AND ')
            if ($uniqueCols.ContainsKey($table)) {
                foreach ($uCol in $uniqueCols[$table]) {
                    $condList += "target.[$uCol] = src.[$uCol]"
                }
            }
            $matchConds = $condList -join ' OR '

            $null = $sb.AppendLine("INSERT INTO [$table] ($colListSql)")
            $null = $sb.AppendLine("SELECT $srcColListSql")
            $null = $sb.AppendLine("FROM (VALUES")
            $null = $sb.AppendLine(($valueRows -join ",`n"))
            $null = $sb.AppendLine(") AS src($colListSql)")
            $null = $sb.AppendLine("WHERE NOT EXISTS (SELECT 1 FROM [$table] target WHERE $matchConds);")
            $null = $sb.AppendLine("GO")
        }

        if ($hasIdentity) {
            $null = $sb.AppendLine("SET IDENTITY_INSERT [$table] OFF;")
            $null = $sb.AppendLine("GO`n")
        } else {
            $null = $sb.AppendLine("")
        }
    }

    $null = $sb.AppendLine("-- Bat lai toan bo kiem tra khoa ngoai")
    $null = $sb.AppendLine("EXEC sp_MSforeachtable 'ALTER TABLE ? CHECK CONSTRAINT ALL';")
    $null = $sb.AppendLine("GO`n")

    $conn.Close()

    [System.IO.File]::WriteAllText($DataFile, $sb.ToString(), [System.Text.Encoding]::UTF8)

    Write-Host "`n[Thanh cong] Da xuat tong cong $totalExportedRows ban ghi vao file:" -ForegroundColor Green
    Write-Host "  $DataFile" -ForegroundColor Yellow
    Write-Host "Ban co the commit va push file nay len Git de cac ban khac dong bo!`n" -ForegroundColor Cyan
}

function Sync-Database([bool]$ForceReset = $false) {
    $server = Get-DatabaseServer
    Write-Host "`n>>> [SYNC] Dang kiem tra co so du lieu '$Database' (SQL Server: $server)..." -ForegroundColor Cyan

    $masterConnStr = Get-ConnectionString -TargetDb 'master'
    if (-not (Test-SqlConnection $masterConnStr)) {
        Write-Host "Loi: Khong the ket noi toi SQL Server '$server' (master). Hay dam bao dich vu MSSQL dang chay!" -ForegroundColor Red
        return
    }

    $masterConn = New-Object System.Data.SqlClient.SqlConnection($masterConnStr)
    $masterConn.Open()

    $chkDbCmd = $masterConn.CreateCommand()
    $chkDbCmd.CommandText = "SELECT COUNT(*) FROM sys.databases WHERE name = '$Database';"
    $dbExists = ($chkDbCmd.ExecuteScalar() -gt 0)

    if ($ForceReset -and $dbExists) {
        Write-Host "[Reset] Dang xoa database cu '$Database'..." -ForegroundColor Yellow
        $dropCmd = $masterConn.CreateCommand()
        $dropCmd.CommandText = "ALTER DATABASE [$Database] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [$Database];"
        $dropCmd.ExecuteNonQuery()
        $dbExists = $false
    }

    if (-not $dbExists) {
        Write-Host "[1/3] Database '$Database' chua co - dang tu dong tao moi tren '$server'..." -ForegroundColor Green
        $createDbCmd = $masterConn.CreateCommand()
        $createDbCmd.CommandText = "CREATE DATABASE [$Database];"
        $createDbCmd.ExecuteNonQuery()
        Write-Host "      Da tao database '$Database' thanh cong!" -ForegroundColor Green
    } else {
        Write-Host "[1/3] Database '$Database' da ton tai tren '$server' - se tien hanh dong bo cap nhat." -ForegroundColor Green
    }
    $masterConn.Close()

    Write-Host "[2/3] Kiem tra va cap nhat schema bang (init-db.sql)..." -ForegroundColor Green
    if (Test-Path $SchemaFile) {
        Execute-SqlFile $SchemaFile
        Write-Host "      Schema da san sang!" -ForegroundColor Green
    } else {
        Write-Host "      (Khong tim thay $SchemaFile - he thong se dung schema mac dinh)" -ForegroundColor Yellow
    }

    Write-Host "[3/3] Dang dong bo du lieu tu file seed vao database..." -ForegroundColor Green
    if (Test-Path $DataFile) {
        Execute-SqlFile $DataFile
        Write-Host "      Dong bo du lieu hoan tat!" -ForegroundColor Green
    } else {
        Write-Host "      Chua co file $DataFile. Ban co the chay -Action Export de tao file mau." -ForegroundColor Yellow
    }

    Get-StoreDbStatus
}

function Execute-SqlFile([string]$filePath) {
    $server = Get-DatabaseServer
    $hasSqlcmd = (Get-Command sqlcmd -ErrorAction SilentlyContinue)
    $useAdoNet = $false

    if ($hasSqlcmd) {
        Write-Host "      [SQLCMD] Thuc thi qua sqlcmd (Server: $server)..." -ForegroundColor DarkGray
        & sqlcmd -S $server -C -d $Database -i $filePath
        if ($LASTEXITCODE -ne 0) {
            Write-Host "      [Luu y] sqlcmd tra ve exit code $LASTEXITCODE. Dang thuc thi bo tro qua ADO.NET..." -ForegroundColor Yellow
            $useAdoNet = $true
        }
    } else {
        $useAdoNet = $true
    }

    if ($useAdoNet) {
        Write-Host "      [ADO.NET] Dang nap truc tiep qua System.Data.SqlClient (Server: $server)..." -ForegroundColor DarkGray
        $connStr = Get-ConnectionString
        $conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
        $conn.Open()

        $content = [System.IO.File]::ReadAllText($filePath, [System.Text.Encoding]::UTF8)
        $batches = $content -split "(?im)^\s*GO\s*$"

        foreach ($batch in $batches) {
            $sql = $batch.Trim()
            if (-not [string]::IsNullOrWhiteSpace($sql)) {
                try {
                    $cmd = $conn.CreateCommand()
                    $cmd.CommandText = $sql
                    $cmd.CommandTimeout = 180
                    $cmd.ExecuteNonQuery() | Out-Null
                } catch {
                }
            }
        }
        $conn.Close()
    }
}


function Get-StoreDbStatus() {
    $server = Get-DatabaseServer
    Write-Host "`n============================================================" -ForegroundColor Cyan
    Write-Host "           THONG TIN CSDL DU AN STORE ($Database)" -ForegroundColor Cyan
    Write-Host "           SQL Server Instance: $server" -ForegroundColor DarkCyan
    Write-Host "============================================================" -ForegroundColor Cyan

    $connStr = Get-ConnectionString
    if (-not (Test-SqlConnection $connStr)) {
        Write-Host "Trang thai: KHONG KET NOI DUOC toi '$Database'." -ForegroundColor Red
        Write-Host "Hay kiem tra SQL Server da duoc bat hay chua.`n" -ForegroundColor Yellow
        return
    }

    $conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
    $conn.Open()
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = @"
SELECT 
    t.name AS TableName,
    p.rows AS RowCounts
FROM sys.tables t
INNER JOIN sys.partitions p ON t.object_id = p.object_id
WHERE p.index_id IN (0,1)
ORDER BY t.name;
"@
    $adapter = New-Object System.Data.SqlClient.SqlDataAdapter($cmd)
    $dt = New-Object System.Data.DataTable
    $adapter.Fill($dt) | Out-Null
    $conn.Close()

    Write-Host ("{0,-28} | {1,12}" -f "Ten Bang", "So Ban Ghi") -ForegroundColor White
    Write-Host ("-" * 44) -ForegroundColor Gray

    $totalRows = 0
    foreach ($r in $dt.Rows) {
        $name = $r['TableName']
        $count = [int64]$r['RowCounts']
        $totalRows += $count
        $color = $(if ($count -gt 0) { "Green" } else { "DarkGray" })
        Write-Host ("{0,-28} | {1,12:N0}" -f $name, $count) -ForegroundColor $color
    }

    Write-Host ("-" * 44) -ForegroundColor Gray
    Write-Host ("{0,-28} | {1,12:N0}" -f "TONG CONG", $totalRows) -ForegroundColor Yellow
    Write-Host "============================================================`n" -ForegroundColor Cyan
}

switch ($Action.ToLower()) {
    'export' {
        Export-Database
        break
    }
    'sync' {
        Sync-Database -ForceReset $false
        break
    }
    'import' {
        Sync-Database -ForceReset $false
        break
    }
    'reset' {
        Sync-Database -ForceReset $true
        break
    }
    'status' {
        Get-StoreDbStatus
        break
    }
    default {
        Write-Host "============================================================" -ForegroundColor Cyan
        Write-Host "        STORE & STORE-ADMIN - CONG CU DONG BO CSDL" -ForegroundColor Cyan
        Write-Host "============================================================" -ForegroundColor Cyan
        Write-Host "  1. [Export] Xuat CSDL local ra file de push len Git" -ForegroundColor White
        Write-Host "  2. [Sync]   Dong bo CSDL tu Git vao may nay (Mac dinh)" -ForegroundColor Green
        Write-Host "  3. [Reset]  Xoa tao lai DB trang & nap sach tu file Git" -ForegroundColor Yellow
        Write-Host "  4. [Status] Xem trang thai ket noi va so luong ban ghi" -ForegroundColor White
        Write-Host "  0. Thoat" -ForegroundColor DarkGray
        Write-Host "============================================================" -ForegroundColor Cyan

        $choice = Read-Host "Nhap lua chon [1-4, hoac nhan Enter de Dong Bo]"
        if ([string]::IsNullOrWhiteSpace($choice) -or $choice -eq '2') {
            Sync-Database -ForceReset $false
        } elseif ($choice -eq '1') {
            Export-Database
        } elseif ($choice -eq '3') {
            $confirm = Read-Host "CANH BAO: Thao tac nay se xoa sach DB StoreDb de nap lai. Tiep tuc? (y/N)"
            if ($confirm -eq 'y' -or $confirm -eq 'Y') {
                Sync-Database -ForceReset $true
            } else {
                Write-Host "Da huy thao tac Reset." -ForegroundColor Yellow
            }
        } elseif ($choice -eq '4') {
            Get-StoreDbStatus
        } else {
            Write-Host "Tam biet!" -ForegroundColor DarkGray
        }
    }
}

