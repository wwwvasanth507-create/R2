#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# PostgreSQL Disaster Recovery Restore Script
# Usage: ./db-restore.sh /path/to/backup.sql.gz
# ==============================================================================

if [ -z "${1:-}" ]; then
  echo "❌ Error: Please specify backup file path. Example: ./db-restore.sh /var/backups/postgres/backup_20261115.sql.gz"
  exit 1
fi

BACKUP_FILE="$1"
CHECKSUM_FILE="${BACKUP_FILE}.sha256"

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "❌ Error: Backup file ${BACKUP_FILE} not found."
  exit 1
fi

echo "🔍 Verifying SHA-256 backup integrity..."
if [ -f "${CHECKSUM_FILE}" ]; then
  sha256sum -c "${CHECKSUM_FILE}"
else
  echo "⚠️ Warning: Checksum file not found. Proceeding with caution."
fi

echo "🔄 Restoring PostgreSQL database from ${BACKUP_FILE}..."
docker exec -i prod_postgres pg_restore -U "${POSTGRES_USER:-media_prod_user}" -d "${POSTGRES_DB:-media_platform_prod}" \
  --clean --if-exists < "${BACKUP_FILE}"

echo "✅ Database restore successfully completed at $(date)."
