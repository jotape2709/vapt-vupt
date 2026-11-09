#!/usr/bin/env bash
# Gera um segredo de 40 caracteres, incluindo caracteres reservados de URL (/ @ : % ? # …).
# Escreva-o no .env ENTRE ASPAS SIMPLES:  VV_RUNTIME_PASSWORD='<saída>'
# Nunca contém aspas, barra invertida, espaço, chaves ou crase (que mudariam a interpretação do .env
# ou do realm do Keycloak). As senhas do banco não entram em URLs (pg-connection.ts).
set -eu
# (sem pipefail: o tr termina por SIGPIPE quando o head já leu o suficiente)
secret=$(LC_ALL=C tr -dc 'A-Za-z0-9/@:%+=?#&!*._~,;$^()-' < /dev/urandom | head -c "${1:-40}")
[ "${#secret}" -eq "${1:-40}" ] || { echo "falha ao gerar segredo" >&2; exit 1; }
printf '%s\n' "$secret"
