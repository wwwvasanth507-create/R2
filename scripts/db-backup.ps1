<#
.SYNOPSIS
    PostgreSQL Production Automated Backup Script for Windows
#>

param (
    [string]$BackupDir = "C:\backups\postgres",
    [string]$ContainerName = "prod_postgres",
    [string]$DbUser = "media_prod_user",
    [string]$DbName = "media_platform_prod"
)

$ErrorActionPreference = "Stop"
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupFile = Join-Path $BackupDir "media_platform_backup_$Timestamp.dump"
$ChecksumFile = "$BackupFile.sha256"

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

Write-Host "📦 Starting PostgreSQL backup at $(Get-Date)..." -ForegroundColor Cyan

docker exec $ContainerName pg_dump -U $DbUser -d $DbName -F c > $BackupFile

$hash = (Get-FileHash -Path $BackupFile -Algorithm SHA256).Hash
Set-Content -Path $ChecksumFile -Value $hash

Write-Host "✅ Backup created: $BackupFile" -ForegroundColor Green
Write-Host "🔒 SHA-256: $hash" -ForegroundColor Green
