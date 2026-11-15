#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# PostgreSQL Production Automated Backup Script
# Retention Policy: 30 days
# ==============================================================================

BACKUP_DIR="${BACKUP_DIR:-/var/backups/postgres}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/media_platform_backup_${TIMESTAMP}.sql.gz"
CHECKSUM_FILE="${BACKUP_FILE}.sha256"

mkdir -p "${BACKUP_DIR}"

echo "📦 Starting PostgreSQL backup at $(date)..."

# Perform backup with pg_dump and gzip
docker exec prod_postgres pg_dump -U "${POSTGRES_USER:-media_prod_user}" -d "${POSTGRES_DB:-media_platform_prod}" \
  --format=custom --compress=9 > "${BACKUP_FILE}"

# Compute SHA-256 integrity checksum
sha256sum "${BACKUP_FILE}" > "${CHECKSUM_FILE}"

echo "✅ Backup successfully created: ${BACKUP_FILE}"
echo "🔒 Checksum: $(cat "${CHECKSUM_FILE}")"

# Prune backups older than 30 days
find "${BACKUP_DIR}" -type f -name "media_platform_backup_*.sql.gz*" -mtime +30 -delete
echo "🧹 Pruned snapshots older than 30 days."
