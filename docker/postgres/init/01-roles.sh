#!/bin/bash
# Papéis do ambiente LOCAL de desenvolvimento (executado só na primeira inicialização do volume).
# vv_migrator: dono do schema, aplica migrations e provisionamento administrativo.
# vv_app: grupo NOLOGIN com os grants mínimos (db/grants/runtime.sql).
# vv_runtime: login da API, membro de vv_app; sem superusuário, sem BYPASSRLS, sem ownership.
set -euo pipefail
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
 -v migrator_pw="$VV_MIGRATOR_PASSWORD" -v runtime_pw="$VV_RUNTIME_PASSWORD" -v db="$POSTGRES_DB" <<'SQL'
CREATE ROLE vv_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD :'migrator_pw';
CREATE ROLE vv_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
CREATE ROLE vv_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS IN ROLE vv_app PASSWORD :'runtime_pw';
ALTER SCHEMA public OWNER TO vv_migrator;
REVOKE ALL ON DATABASE :"db" FROM PUBLIC;
GRANT CONNECT ON DATABASE :"db" TO vv_migrator, vv_runtime;
SQL
