#!/bin/sh
# Creates the aca-snapshots bucket (CODEBASE.md "File Content Storage")
# against the local MinIO instance. Idempotent — safe to run on every
# `pnpm infra:up`.
set -eu

mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"
mc mb --ignore-existing "local/$MINIO_BUCKET"
echo "bucket $MINIO_BUCKET ready"
