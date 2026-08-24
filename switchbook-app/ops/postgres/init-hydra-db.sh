#!/bin/sh
set -eu

: "${HYDRA_DB_USER:?HYDRA_DB_USER is required}"
: "${HYDRA_DB_PASSWORD:?HYDRA_DB_PASSWORD is required}"
: "${HYDRA_DB_NAME:?HYDRA_DB_NAME is required}"

psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set=hydra_user="$HYDRA_DB_USER" --set=hydra_password="$HYDRA_DB_PASSWORD" --set=hydra_db="$HYDRA_DB_NAME" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'hydra_user', :'hydra_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = :'hydra_user') \gexec
SELECT format('CREATE DATABASE %I OWNER %I', :'hydra_db', :'hydra_user')
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'hydra_db') \gexec
SELECT format('REVOKE ALL ON DATABASE %I FROM PUBLIC', :'hydra_db') \gexec
SQL
