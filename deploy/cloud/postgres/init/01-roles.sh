#!/bin/bash
# Papéis da instalação em NUVEM (executado só na criação do volume pgdata).
#   vv_migrator  dono do schema: migrations, provisionamento e backup lógico
#   vv_app       grupo NOLOGIN com os grants mínimos (db/grants/runtime.sql)
#   vv_runtime   login da API, membro de vv_app; sem superusuário, BYPASSRLS ou ownership
#   keycloak     dono exclusivo do banco "keycloak"; sem acesso ao banco vapt_vupt
# Recusa senhas de exemplo: um volume de produção nunca nasce com credencial conhecida.
set -euo pipefail
for var in VV_MIGRATOR_PASSWORD VV_RUNTIME_PASSWORD VV_KEYCLOAK_DB_PASSWORD POSTGRES_PASSWORD; do
 value="${!var:-}"
 if [ "${#value}" -lt 24 ] || [[ "$value" == dev-only* ]] || [[ "$value" == *REPLACE* ]] || [[ "$value" == *CHANGE* ]]; then
  echo "init: $var ausente, curta (<24) ou de exemplo. Gere com: openssl rand -base64 32" >&2
  exit 1
 fi
done
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
 -v migrator_pw="$VV_MIGRATOR_PASSWORD" -v runtime_pw="$VV_RUNTIME_PASSWORD" \
 -v keycloak_pw="$VV_KEYCLOAK_DB_PASSWORD" -v db="$POSTGRES_DB" <<'SQL'
CREATE ROLE vv_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD :'migrator_pw';
CREATE ROLE vv_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
CREATE ROLE vv_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS IN ROLE vv_app PASSWORD :'runtime_pw' CONNECTION LIMIT 20;
CREATE ROLE keycloak LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD :'keycloak_pw' CONNECTION LIMIT 30;
ALTER SCHEMA public OWNER TO vv_migrator;
REVOKE ALL ON DATABASE :"db" FROM PUBLIC;
GRANT CONNECT ON DATABASE :"db" TO vv_migrator, vv_runtime;
CREATE DATABASE keycloak OWNER keycloak;
REVOKE ALL ON DATABASE keycloak FROM PUBLIC;
SQL
