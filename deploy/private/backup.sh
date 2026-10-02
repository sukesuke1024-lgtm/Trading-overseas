#!/bin/bash
# 毎日のバックアップ（暗号化）。使い方:  BACKUP_PASSPHRASE=... ./backup.sh [保存先フォルダ]
# 保存先は別のディスク/別の場所（クラウドの同期フォルダでも、暗号化済みなので中身は読まれない）。cron 例: 0 3 * * * cd /path/deploy/private && BACKUP_PASSPHRASE=... ./backup.sh ~/hlink-backup
set -euo pipefail
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE を設定してください}"
DEST="${1:-$HOME/hlink-backup}"; mkdir -p "$DEST"; chmod 700 "$DEST"
STAMP="$(date +%Y%m%d-%H%M%S)"
for v in portal-data crm-data; do
  docker run --rm -v "hlink_${v}:/data:ro" alpine tar -C /data -cz . \
    | openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt -pass env:BACKUP_PASSPHRASE -out "$DEST/${v}-${STAMP}.tar.gz.enc"
done
find "$DEST" -name '*.tar.gz.enc' -mtime +35 -delete   # 35日より古いものを削除
echo "backup ok: $DEST (${STAMP})"
# 復元: openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -pass env:BACKUP_PASSPHRASE -in <file> | docker run --rm -i -v hlink_<name>:/data alpine tar -C /data -xz
