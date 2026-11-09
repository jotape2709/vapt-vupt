#!/usr/bin/env bash
# Teste de compatibilidade de release: a versão ANTERIOR da aplicação funciona sobre o schema
# produzido por ESTA versão? É o que permite reverter só a imagem depois de uma atualização.
#
#   TEST_ADMIN_DATABASE_URL=postgresql://postgres:...@127.0.0.1:55432/postgres \
#     bash scripts/compat-previous.sh <ref-git-da-versão-anterior> [migration-extra.sql ...]
#
# 1. cria um banco NOVO no PostgreSQL de teste (nunca use um banco real);
# 2. aplica as migrations e os grants DESTA árvore (mais as migrations extras, usadas só para
#    provar que o teste detecta quebra);
# 3. roda os testes da versão anterior (worktree temporária, sem branch) com o código anterior e o
#    db/ desta árvore, contra esse banco;
# 4. remove banco e worktree.
# Sai com 0 só se todos os testes da versão anterior passarem. Exigido para declarar
# "-- compatibilidade-anterior: sim" numa migration (docs/cloud/OPERACAO.md#atualização-e-reversão).
# Usa as dependências desta árvore (node_modules); se o package-lock mudou entre as versões, rode
# com VV_COMPAT_NPM_CI=1.
set -euo pipefail
ref="${1:?informe o ref git da versão anterior}"; shift
admin="${TEST_ADMIN_DATABASE_URL:?defina TEST_ADMIN_DATABASE_URL (PostgreSQL descartável)}"
repo="$(cd "$(dirname "$0")/.." && pwd)"
prev_sha=$(git -C "$repo" rev-parse --verify "$ref^{commit}")
db="vv_compat_$$"
work=$(mktemp -d); wt="$work/previous"
dburl=$(node -e 'const u=new URL(process.argv[1]); u.pathname="/"+process.argv[2]; console.log(u.toString())' "$admin" "$db")
sql() { node -e 'const {Client}=require("pg"); (async()=>{const c=new Client({connectionString:process.argv[1]}); await c.connect(); try { await c.query(process.argv[2]); } finally { await c.end(); }})().catch(e=>{console.error(e.message); process.exit(1)})' "$@"; }
cleanup() {
 sql "$admin" "DROP DATABASE IF EXISTS $db WITH (FORCE)" >/dev/null 2>&1 || true
 git -C "$repo" worktree remove --force "$wt" >/dev/null 2>&1 || true
 rm -rf "$work"
}
trap cleanup EXIT
cd "$repo"

echo "== Versão anterior: $ref ($prev_sha); schema: esta árvore ($(git rev-parse --short HEAD)$(git diff --quiet HEAD -- db || echo ', com alterações locais em db/'))"
git worktree add --detach "$wt" "$prev_sha" >/dev/null 2>&1
rm -rf "$wt/db"; cp -R "$repo/db" "$wt/db"
if [ "${VV_COMPAT_NPM_CI:-0}" = 1 ]; then (cd "$wt" && npm ci --no-audit --no-fund >/dev/null); else ln -s "$repo/node_modules" "$wt/node_modules"; fi

sql "$admin" "CREATE DATABASE $db"
sql "$admin" "DO \$\$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='vv_app') THEN CREATE ROLE vv_app NOLOGIN NOSUPERUSER NOBYPASSRLS; END IF; END \$\$"
MIGRATION_DATABASE_URL="$dburl" MIGRATION_DATABASE_PASSWORD='' npx tsx apps/api/migrate.ts
for extra in "$@"; do
 echo "== Migration extra (teste do teste): $(basename "$extra")"
 sql "$dburl" "$(cat "$extra")"
done

echo "== Testes da versão anterior sobre o schema novo"
(cd "$wt" && TEST_ADMIN_DATABASE_URL="$dburl" npx tsx --test --test-concurrency=1 tests/*.test.ts) > "$work/tests.log" 2>&1 && rc=0 || rc=$?
grep -E '^# (tests|pass|fail|skipped)' "$work/tests.log" | sed 's/^# /   /'
if [ "$rc" = 0 ]; then
 echo "== COMPATÍVEL: a versão $ref funciona sobre o schema desta árvore"
else
 grep -E '^not ok|Error|error:' "$work/tests.log" | head -15 | sed 's/^/   /'
 echo "== INCOMPATÍVEL: reverter só a imagem para $ref não é seguro com este schema"
fi
exit "$rc"
