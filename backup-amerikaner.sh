#!/usr/bin/env bash
# Daglig backup av am.pokergutta.no sin SQLite-database.
# Kopier til ~/backups/ og legg inn i crontab:
#   20 3 * * * /home/ragnar/backups/backup-amerikaner.sh >> /home/ragnar/backups/backup.log 2>&1
set -euo pipefail

DATE=$(date +%F_%H-%M-%S)
APP_DIR=/home/ragnar/apps/amerikaner
LOCAL_ROOT=/home/ragnar/backups/amerikaner
LOCAL_RETENTION_DAYS=7
REMOTE_HOST=holthe.org
REMOTE_USER=ragnar
REMOTE_KEY=/home/ragnar/.ssh/ekstern1_backup_key
ALERT_TO=ragnar@holthe.org
POSTFIX_CONTAINER=mailcowdockerized-postfix-mailcow-1

send_alert() {
  {
    echo "To: ${ALERT_TO}"
    echo "From: backup@mail.holthe.org"
    echo "Subject: $1"
    echo
    echo "$2"
  } | docker exec -i "${POSTFIX_CONTAINER}" sendmail -t
}

on_error() {
  local exit_code=$?
  send_alert "[FEIL] Amerikaner-backup feilet - ${DATE}" \
    "Backup-scriptet feilet med exit-kode ${exit_code}. Se ~/backups/backup.log."
  exit "${exit_code}"
}
trap on_error ERR

echo "=== $(date -Is) - Starter amerikaner-backup for ${DATE} ==="
mkdir -p "${LOCAL_ROOT}"

# Enkel filkopi. Appen skriver bare mens gutta spiller, og da sitter ingen og
# tar backup kl. 03:20. Samme avveining som pokergutta-backupen.
cp "${APP_DIR}/data/amerikaner.db" "${LOCAL_ROOT}/amerikaner.db.${DATE}"

echo "--- Rsyncer til ${REMOTE_HOST} ---"
rsync -a \
  -e "ssh -i ${REMOTE_KEY} -o StrictHostKeyChecking=accept-new" \
  "${LOCAL_ROOT}/" "${REMOTE_USER}@${REMOTE_HOST}:amerikaner/"

echo "--- Rydder lokale backups eldre enn ${LOCAL_RETENTION_DAYS} dager ---"
find "${LOCAL_ROOT}" -maxdepth 1 -type f -name 'amerikaner.db.*' \
  -mtime "+${LOCAL_RETENTION_DAYS}" -print -delete

echo "=== $(date -Is) - Ferdig ==="
