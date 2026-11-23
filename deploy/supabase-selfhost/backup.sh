#!/usr/bin/env bash
# Nightly logical backup — install ON THE DROPLET at /root/supabase-project/backup.sh:
#   crontab -e  →  30 17 * * * /root/supabase-project/backup.sh   (01:30 PHT)
# Keeps 14 days. Pair with DigitalOcean Droplet Backups (weekly snapshots) and
# ideally copy the backups dir off-box (e.g. rclone to DO Spaces).
set -euo pipefail
DIR=/root/backups
mkdir -p "$DIR"
STAMP=$(date -u +%Y%m%d-%H%M)
docker exec supabase-db pg_dumpall -h localhost -U supabase_admin | gzip > "$DIR/db-$STAMP.sql.gz"
tar -czf "$DIR/storage-$STAMP.tar.gz" -C /root/supabase-project/volumes storage
find "$DIR" -type f -mtime +14 -delete
