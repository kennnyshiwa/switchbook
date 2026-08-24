#!/bin/sh
# Safe, idempotent bootstrap for an existing postgres_data volume.
set -eu
docker compose exec -T postgres /docker-entrypoint-initdb.d/20-init-hydra-db.sh
docker compose run --rm --no-deps --entrypoint /bin/ash hydra -c '/usr/bin/hydra migrate sql --yes "$HYDRA_DSN"'
