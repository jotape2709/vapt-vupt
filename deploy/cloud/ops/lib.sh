# Funções comuns dos scripts de operação (source, não executar).
# VV_ENV_FILE escolhe o arquivo de ambiente (padrão: deploy/cloud/.env).
set -euo pipefail
VV_CLOUD_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VV_ENV_FILE="${VV_ENV_FILE:-$VV_CLOUD_DIR/.env}"
VV_BACKUP_ENV_FILE="${VV_BACKUP_ENV_FILE:-$VV_CLOUD_DIR/backup.env}"
VV_COMPOSE_FILES=(-f "$VV_CLOUD_DIR/compose.yaml" ${VV_COMPOSE_EXTRA:+$VV_COMPOSE_EXTRA})

# curl para as origens públicas; VV_CURL_CACERT só no ensaio (CA de teste).
pcurl() { curl ${VV_CURL_CACERT:+--cacert "$VV_CURL_CACERT"} "$@"; }
log() { printf '[%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
die() { log "ERRO: $*" >&2; exit 1; }

load_env() {
 [ -f "$VV_ENV_FILE" ] || die "arquivo de ambiente ausente: $VV_ENV_FILE (copie de .env.example)"
 set -a; # shellcheck disable=SC1090
 . "$VV_ENV_FILE"; set +a
 VV_PROJECT="${VV_PROJECT:-vapt-vupt}"
}

dc() { docker compose --project-directory "$VV_CLOUD_DIR" --env-file "$VV_ENV_FILE" -p "$VV_PROJECT" "${VV_COMPOSE_FILES[@]}" "$@"; }

# psql como superusuário local do contêiner (autenticação peer pelo socket; sem senha na linha de comando).
psql_super() { dc exec -T -u postgres postgres psql -v ON_ERROR_STOP=1 -At "$@"; }

wait_healthy() { # serviço, tentativas
 local id; for _ in $(seq 1 "${2:-60}"); do
  id=$(dc ps -q "$1"); [ -n "$id" ] && [ "$(docker inspect -f '{{.State.Health.Status}}' "$id" 2>/dev/null)" = healthy ] && return 0
  sleep 3; done
 die "serviço $1 não ficou saudável"
}

heartbeat() { # sucesso|fail mensagem
 [ -n "${VV_BACKUP_HEARTBEAT_URL:-}" ] || return 0
 local url="$VV_BACKUP_HEARTBEAT_URL"; [ "$1" = fail ] && url="$url/fail"
 curl -fsS -m 10 --retry 3 --data-raw "${2:-}" "$url" >/dev/null || log "aviso: heartbeat não enviado"
}
