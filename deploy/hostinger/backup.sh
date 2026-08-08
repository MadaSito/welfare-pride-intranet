#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"
[[ -f .env ]] || { echo "Missing $ROOT_DIR/.env" >&2; exit 1; }
set -a
source .env
set +a

DESTINATION="${BACKUP_DIRECTORY:-$ROOT_DIR/backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$DESTINATION"
umask 077

docker compose --env-file .env -f deploy/hostinger/docker-compose.yml exec -T database \
  mysqldump --single-transaction --quick -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" \
  | gzip -9 > "$DESTINATION/welfare-pride-db-$STAMP.sql.gz"

docker compose --env-file .env -f deploy/hostinger/docker-compose.yml exec -T app \
  tar -C /app/data -czf - uploads > "$DESTINATION/welfare-pride-uploads-$STAMP.tar.gz"

sha256sum "$DESTINATION/welfare-pride-db-$STAMP.sql.gz" "$DESTINATION/welfare-pride-uploads-$STAMP.tar.gz" \
  > "$DESTINATION/welfare-pride-$STAMP.sha256"

find "$DESTINATION" -type f -name 'welfare-pride-*' -mtime "+${BACKUP_RETENTION_DAYS:-30}" -delete
echo "Backup completed: $STAMP"
