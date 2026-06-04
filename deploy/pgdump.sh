#!/bin/sh
# Weekly logical backup of the Freenote Postgres DB into the LXC rootfs, so PBS captures it.
# Complements the block-level PBS snapshot (which already restores a crash-consistent DB via WAL
# replay): this adds *selective* (one table) and *cross-version* restore. No age, no offsite —
# PBS owns retention/offsite of the whole LXC.
#
#   Restore (selective / cross-version):
#     gunzip -c freenote-XXXX.sql.gz | docker exec -i freenote-postgres psql -U freenote -d freenote
set -eu

DEST=/opt/freenote/backups
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p "$DEST"

# Local socket inside the container is trust-auth (official postgres image) → no password needed.
docker exec freenote-postgres pg_dump -U freenote -d freenote --no-owner \
  | gzip > "$DEST/freenote-$STAMP.sql.gz"

# Keep the 8 most recent dumps (~2 months at a weekly cadence); PBS keeps the long tail.
ls -1t "$DEST"/freenote-*.sql.gz 2>/dev/null | tail -n +9 | xargs -r rm -f
