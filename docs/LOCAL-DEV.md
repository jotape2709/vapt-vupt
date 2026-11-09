# Ambiente local com PostgreSQL e Keycloak

> **Somente desenvolvimento e integração.** HTTP sem TLS, senhas e segredo de cliente de exemplo, Keycloak em modo `start-dev` e imagem da aplicação sem digest. Não é instalação de produção. Veja [SECURITY.md](SECURITY.md).

Requisitos: Docker com Compose v2, Node.js 22.12+ e npm.

## Opção A — tudo no Compose

```bash
docker compose up -d --build --wait   # postgres, keycloak, migrate e app; espera os healthchecks
docker compose --profile tools run --rm seed   # duas empresas de exemplo (idempotente)
```

Para validar a instalação inteira de uma vez (apaga os volumes deste ambiente):

```bash
VV_COMPOSE_CLEAN=1 bash scripts/compose-validate.sh
```

O script sobe tudo do zero, roda seed duas vezes e um `provision` documentado, confere `/health`, `/ready`, `/`, `/demo` e `/app`, o emissor OIDC visto pelo navegador e pela API, os parâmetros do redirect (PKCE S256, `state`, `nonce`, `redirect_uri`), os papéis do banco e a conexão da API como `vv_runtime`, reinicia o PostgreSQL exigindo que a API continue no mesmo processo, e confirma que a API **não inicia** sem `OIDC_CLIENT_SECRET` nem com o papel dono das tabelas.

Atrás de proxy que reemite TLS (rede corporativa), o `npm ci` do build precisa da cadeia de certificados. Passe-a como segredo de build (não fica na imagem) e suba sem reconstruir:

```bash
docker build --secret id=extra_ca,src=/caminho/ca.crt -t vapt-vupt-dev-app:local .
VV_COMPOSE_BUILD=0 bash scripts/compose-validate.sh
```

Abra <http://localhost:3001/app> e entre com um dos usuários abaixo. A demonstração fictícia continua em <http://localhost:3001/demo>.

## Opção B — banco e provedor no Compose, API e interface no host

Útil para depurar a API com recarga.

```bash
npm ci
docker compose up -d postgres keycloak
MIGRATION_DATABASE_URL=postgresql://vv_migrator:dev-only-migrator@localhost:5432/vapt_vupt npm run db:migrate
ADMIN_DATABASE_URL=postgresql://vv_migrator:dev-only-migrator@localhost:5432/vapt_vupt npm run seed:local
npm run build
DATABASE_URL=postgresql://vv_runtime:dev-only-runtime@localhost:5432/vapt_vupt \
APP_ORIGIN=http://localhost:3001 \
OIDC_ISSUER=http://localhost:8080/realms/vapt OIDC_ALLOW_HTTP=true \
OIDC_CLIENT_ID=vapt-vupt-web OIDC_CLIENT_SECRET=dev-only-client-secret-not-for-production \
WEB_DIST_DIR=dist npm run dev:api
```

Para editar a interface com recarga rápida, rode a API com `APP_ORIGIN=http://localhost:5173` e, em outro terminal, `npm run dev`: o Vite encaminha `/api` e `/auth` para a porta 3001 (o realm já aceita o retorno em 5173).

## Papéis do banco

`docker/postgres/init/01-roles.sh` cria, no primeiro start do volume:

| Papel | Uso |
|---|---|
| `postgres` | Superusuário do container. Só para manutenção manual. |
| `vv_migrator` | Dono do schema. Migrações (`npm run db:migrate`), seed e `npm run admin`. |
| `vv_app` | Grupo `NOLOGIN` que recebe os grants mínimos de `db/grants/runtime.sql`. |
| `vv_runtime` | Login da API, membro de `vv_app`. Sem superusuário, `BYPASSRLS` ou ownership. |

As senhas vêm de `VV_MIGRATOR_PASSWORD`, `VV_RUNTIME_PASSWORD` e `VV_POSTGRES_PASSWORD` (padrões `dev-only-*`).

## Usuários e empresas de exemplo

Criados por `docker/keycloak/realm-vapt.json` (identidades) e `scripts/seed-local.ts` (empresas e funções). O seed recusa emissores fora de `localhost` e não importa dados para empresas reais.

| Usuário | Senha | Mercado Aurora (mercado, azul) | Adega Vértice (adega, marinho, escuro) |
|---|---|---|---|
| `ana` | `dev-ana-local` | Proprietário | Consulta |
| `bruno` | `dev-bruno-local` | Operador | — |
| `carla` | `dev-carla-local` | — | Proprietário |
| `davi` | `dev-davi-local` | Consulta | — |
| `eva` | `dev-eva-local` | — | — (vê a tela “sem acesso”) |

Console do Keycloak: <http://localhost:8080/admin> (`admin` / `dev-only-admin`).

## Administração

```bash
export ADMIN_DATABASE_URL=postgresql://vv_migrator:dev-only-migrator@localhost:5432/vapt_vupt
# Nova empresa com proprietário (subject = "sub" do provedor, mostrado na tela "sem acesso")
npm run admin -- provision --name "Bar do Porto" --segment bar --unit "Salão" \
  --owner-issuer http://localhost:8080/realms/vapt --owner-subject a0000000-0000-4000-8000-0000000000e5
npm run admin -- grant  --org <orgId> --issuer <issuer> --subject <sub> --role operator   # viewer|operator|manager|owner
npm run admin -- revoke --org <orgId> --issuer <issuer> --subject <sub>
npm run admin -- revoke-sessions --issuer <issuer> --subject <sub>
```

No Compose: `docker compose --profile tools run --rm admin provision --name …`. Cada comando roda numa transação e grava em `audit_log` com o ator `admin-cli:<VV_ADMIN_ACTOR ou usuário do sistema>`.

## Testes

```bash
npm run lint && npm run build
MIGRATION_DATABASE_URL=postgresql://postgres:<senha>@localhost:5432/vv_test npm run db:migrate
TEST_ADMIN_DATABASE_URL=postgresql://postgres:<senha>@localhost:5432/vv_test npm test
npm run test:browser                  # demonstração e regressões visuais (Playwright)
E2E_ADMIN_DATABASE_URL=postgresql://vv_migrator:dev-only-migrator@localhost:5432/vapt_vupt \
  npm run test:e2e-real               # fluxo real; reinicia postgres, keycloak e app no meio
```

- `npm test` com `TEST_ADMIN_DATABASE_URL` aplica os grants, cria o papel `vv_app` se faltar e roda a integração **como `vv_app`** (sem superusuário, sem `BYPASSRLS`). **Use um banco descartável já migrado**: o teste cria papel e dados. Sem a variável, a integração é ignorada e aparece como `skipped`.
- `npm run test:e2e-real` usa o ambiente acima (opção A por padrão). Na opção B, defina `E2E_RESTART_CMD` com o comando que reinicia os serviços e a API. Com `E2E_SCREENSHOTS_DIR` ele salva capturas.
- Em máquinas com Chromium já instalado, defina `PLAYWRIGHT_CHROMIUM_PATH`.

## Recomeçar do zero

```bash
docker compose down -v   # apaga os volumes pgdata e kcdata deste ambiente
```
