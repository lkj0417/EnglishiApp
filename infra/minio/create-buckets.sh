#!/bin/sh
set -eu

until mc alias set local "${MINIO_ENDPOINT}" "${MINIO_ACCESS_KEY}" "${MINIO_SECRET_KEY}"; do
  echo "Waiting for MinIO at ${MINIO_ENDPOINT}..."
  sleep 2
done

mc mb --ignore-existing "local/${MINIO_BUCKET_AUDIO:-easitalk-audio}"
mc mb --ignore-existing "local/${MINIO_BUCKET_MATERIALS:-easitalk-materials}"
mc anonymous set none "local/${MINIO_BUCKET_AUDIO:-easitalk-audio}"
mc anonymous set none "local/${MINIO_BUCKET_MATERIALS:-easitalk-materials}"

