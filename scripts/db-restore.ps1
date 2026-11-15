param (
    [Parameter(Mandatory=$true)]
    [string]$BackupFile,
    [string]$ContainerName = "prod_postgres",
    [string]$DbUser = "media_prod_user",
    [string]$DbName = "media_platform_prod"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $BackupFile)) {
    Write-Error "Backup file $BackupFile does not exist."
}

Write-Host "🔄 Restoring PostgreSQL database from $BackupFile..." -ForegroundColor Cyan

Get-Content $BackupFile -Raw | docker exec -i $ContainerName pg_restore -U $DbUser -d $DbName --clean --if-exists

Write-Host "✅ Database restore completed successfully." -ForegroundColor Green
