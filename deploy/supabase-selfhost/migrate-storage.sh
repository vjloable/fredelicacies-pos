#!/usr/bin/env bash
# Copy every storage bucket from the cloud project to self-hosted via the S3
# protocol (copying files into volumes/storage directly does NOT work).
# Requires: rclone (brew install rclone). Safe to re-run; rclone skips identical files.
set -euo pipefail
cd "$(dirname "$0")"
source .env.migrate

# Remotes configured through env vars, so no rclone.conf is written to disk.
export RCLONE_CONFIG_CLOUD_TYPE=s3 RCLONE_CONFIG_CLOUD_PROVIDER=Other
export RCLONE_CONFIG_CLOUD_ENDPOINT="https://${CLOUD_REF}.storage.supabase.co/storage/v1/s3"
export RCLONE_CONFIG_CLOUD_REGION="$CLOUD_REGION"
export RCLONE_CONFIG_CLOUD_ACCESS_KEY_ID="$CLOUD_S3_KEY_ID" RCLONE_CONFIG_CLOUD_SECRET_ACCESS_KEY="$CLOUD_S3_SECRET"

export RCLONE_CONFIG_SELF_TYPE=s3 RCLONE_CONFIG_SELF_PROVIDER=Other
export RCLONE_CONFIG_SELF_ENDPOINT="${SELF_URL}/storage/v1/s3"
export RCLONE_CONFIG_SELF_REGION="$SELF_S3_REGION"
export RCLONE_CONFIG_SELF_ACCESS_KEY_ID="$SELF_S3_KEY_ID" RCLONE_CONFIG_SELF_SECRET_ACCESS_KEY="$SELF_S3_SECRET"

for bucket in branch-logos inventory-images bundle-images profile-images; do
  echo "== $bucket"
  rclone copy "cloud:$bucket" "self:$bucket" --transfers 4 --progress
  echo "cloud: $(rclone size "cloud:$bucket" --json)"
  echo "self:  $(rclone size "self:$bucket" --json)"
done
