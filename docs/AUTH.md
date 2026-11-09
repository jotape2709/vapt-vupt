# Autenticação e sessão (ciclo 02)

Padrão **BFF (backend for frontend)**: o navegador nunca recebe nem guarda tokens OIDC. A API conduz o login com o provedor, valida o ID Token e abre uma **sessão de servidor** no PostgreSQL. O navegador só carrega um cookie opaco `HttpOnly`.

Não existe sistema próprio de senhas. Senha, MFA, recuperação de conta e bloqueio ficam no provedor OIDC (Keycloak no ambiente local; qualquer provedor OIDC certificado em produção).

## Componentes

| Peça | Onde | Responsabilidade |
|---|---|---|
| `openid-client` 6 (certificado pela OpenID Foundation) | `apps/api/oidc.ts` | Descoberta, Authorization Code + PKCE (S256), `state`, `nonce`, troca do código com `client_secret_basic`, validação do ID Token (assinatura via JWKS, `iss`, `aud`, `exp`, `nonce`), URL de logout |
| `SessionStore` | `apps/api/sessions.ts` | Transações de login de uso único, sessões, expiração, rotação e revogação |
| Rotas `/auth/*` e hook de `/api` | `apps/api/app.ts` | Cookies, CSRF, verificação de origem, respostas 401 |
| `loadConfig` | `apps/api/config.ts` | Recusa iniciar sem `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `APP_ORIGIN` ou `DATABASE_URL` |

**Ausência de configuração não ativa autenticação falsa.** Não há modo “dev sem login”, cabeçalho de bypass ou token de demonstração aceito pela API. A fixture OIDC de `tests/support/oidc-fixture.ts` só existe nos testes e é injetada pelo construtor de `buildApp`; o servidor (`server.ts`) sempre usa o provedor real.

## Fluxo de login

1. `GET /auth/login?returnTo=/app` gera `state`, `nonce` e `code_verifier`, grava a transação em `auth_transactions` (hash do segredo, expira em 10 min) e define o cookie `vv_login` (HttpOnly, SameSite=Lax, 10 min). `returnTo` só aceita caminhos sob `/app`.
2. O navegador vai ao provedor (Keycloak), autentica e volta em `GET /auth/callback`.
3. A API consome a transação **uma única vez** (`DELETE … RETURNING`), confere `state` e valida o ID Token com `nonce` e PKCE. O e-mail só é guardado se `email_verified`.
4. O usuário é registrado/atualizado em `users` (issuer + subject; nenhuma senha).
5. É criada uma sessão nova (rotação: nenhum identificador anterior é reaproveitado) e o cookie `vv_session` é emitido. Redireciona para `/app`.
6. Em erro, redireciona para `/app?auth_error=expired|denied|failed` sem detalhes internos.

## Sessão

- Cookie: 32 bytes aleatórios em base64url. O banco guarda **somente o SHA-256** do valor, então um vazamento da tabela não reproduz cookies.
- Atributos: `HttpOnly`, `SameSite=Lax`, `Path=/`; `Secure` e prefixo `__Host-` sempre que `APP_ORIGIN` é HTTPS (obrigatório fora de localhost).
- Expiração por inatividade: 30 min (`SESSION_IDLE_MINUTES`), deslizante, atualizada no máximo uma vez por minuto.
- Expiração absoluta: 12 h (`SESSION_ABSOLUTE_HOURS`).
- Encerramento: `POST /auth/logout` revoga a sessão no banco, apaga o cookie e devolve a URL de `end_session` do provedor (com `id_token_hint` guardado só no servidor e apagado na revogação). A interface navega para ela e volta em `/app?signed_out=1`.
- Invalidação administrativa: `npm run admin -- revoke-sessions --issuer … --subject …` revoga todas as sessões de uma pessoa. Remover a membership (`revoke`) corta o acesso à empresa na próxima requisição, porque a membership é consultada a cada operação.
- Sessões expiradas recebem `401 session_expired`; a interface descarta os dados em memória e mostra “Sua sessão terminou”.

## CSRF e origem

- `GET /api/session` devolve um token CSRF por sessão (sincronizador). Toda escrita (`POST/PUT/PATCH/DELETE` em `/api` e o logout) exige `X-CSRF-Token` igual, comparado em tempo constante.
- Além disso, escritas com `Origin` diferente de `APP_ORIGIN` ou `Sec-Fetch-Site: cross-site` são recusadas (`403 csrf_rejected`).
- `SameSite=Lax` é a terceira camada, não a única.

## Armazenamento no navegador

Nenhum token, cookie de sessão ou dado operacional da operação real fica em `localStorage`/`sessionStorage`. O teste `tests/e2e-real/real-flow.spec.ts` (passo 1) confere isso depois do login. A demonstração (`/demo`) continua usando `localStorage` apenas para dados fictícios.

## Ambiente local

`compose.yaml` sobe um Keycloak 26 real com o realm `docker/keycloak/realm-vapt.json` (cliente confidencial `vapt-vupt-web`, PKCE S256 obrigatório, usuários de exemplo). Veja [LOCAL-DEV.md](LOCAL-DEV.md). O segredo do cliente e as senhas desse realm são **apenas de exemplo** e não servem para produção.

## Limitações conhecidas

- Back-channel logout do provedor não é tratado: encerrar a sessão no Keycloak não revoga a sessão da API até ela expirar ou o usuário sair pelo Vapt-Vupt.
- Rate limit em memória (um processo). Várias réplicas exigem limitador compartilhado.
- O provedor local roda em HTTP (`OIDC_ALLOW_HTTP=true`, aceito só para emissores em localhost).
- MFA e políticas de senha dependem da configuração do provedor; o realm local não as exige.
