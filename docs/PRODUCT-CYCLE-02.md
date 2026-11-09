# Ciclo 02 — primeira operação real de ponta a ponta

## Estado e objetivo

Branch única deste ciclo: `product/cycle-02`, criada a partir da `main` no commit `950ac128e53de854cacc3809d4bd0be2a126da7b` (merge do PR #10; commit revisado do ciclo 01: `4e08ff9058b9ef4058254a347d90b16fba55c16f`). Um único PR em rascunho recebe todos os commits deste lote. Sem merge, exclusão de branches, deploy ou serviços pagos.

Objetivo: autenticar → acessar empresa autorizada → configurar a identidade da empresa → cadastrar produto → registrar entrada/saída → consultar saldo e histórico persistidos, com API e PostgreSQL. Dados operacionais não dependem de localStorage.

Este documento é atualizado a cada lote. O registro de passagem fica no final.

## Escopo deste lote

1. Auditoria do frontend, API, migrations, autenticação e testes existentes.
2. Sessão de servidor com OIDC (Authorization Code + PKCE), cookies HttpOnly, CSRF, expiração, logout e invalidação.
3. Organizações, unidades, contexto autenticado e provisionamento administrativo auditado.
4. Configuração versionada por empresa (identidade, aparência, módulos, navegação, visão geral), preferências pessoais separadas, templates de mercado/adega/bar e logotipo validado no servidor.
5. Catálogo por organização e saldo por unidade, com paginação, busca, idempotência, concorrência e reconciliação.
6. UI real com estados de carregamento, erro, sessão expirada, acesso negado, conflito e confirmação do servidor; demonstração mantida como sandbox separada.
7. Matriz de permissões e testes com PostgreSQL real e papel restrito; testes de navegador do fluxo real.
8. Docker Compose de desenvolvimento com PostgreSQL e provedor OIDC real (Keycloak), documentação e limitações.

Fora do escopo: PWA, escrita offline, câmeras, IA de reposição, POS, fiscal, compras e cotações reais.

## Decisões

1. **BFF com sessão de servidor** em vez de tokens no navegador ([AUTH.md](AUTH.md), ADR 006). Cookie opaco HttpOnly, hash no banco, CSRF sincronizador + origem.
2. **Keycloak 26 no Compose** como provedor OIDC real local (realm versionado só com dados de exemplo). Nenhuma senha própria.
3. **Migração 002 aditiva**: 001 intocada; novas tabelas e colunas com migração explícita (tema v1 → configuração v2, `products.quantity` → `stock_levels`, eventos antigos recebem unidade, tipo, saldos e versão). O logotipo legado (data URL dentro do tema) **não** é migrado: precisa ser reenviado e validado.
4. **Papéis separados** (`vv_migrator`, `vv_app`/`vv_runtime`), grants por coluna e gatilhos append-only; a API recusa iniciar com papel privilegiado.
5. **Uma unidade por empresa** no piloto, explícita na interface; catálogo por organização, saldo por unidade.
6. **Configuração versionada** com regras por seção: identidade (nome, segmento, logo) só proprietário; aparência, módulos, navegação e visão geral gestor+; preferências pessoais separadas, por pessoa. Modelos de mercado, adega e bar são dados, não forks.
7. **Paginação keyset e busca no servidor** com contagens; sem limite de 1.000/200 itens (ADR 007).
8. **Resultado desconhecido** é um estado de primeira classe: mesmo `eventId` em qualquer reenvio, reconciliação por `GET /movements/:eventId`.
9. **Demonstração isolada** em `/demo` (DemoGateway); a operação real em `/app` nunca lê nem grava localStorage para dados operacionais. Mensagens contraditórias de persistência/restauração do ciclo 01 foram corrigidas.
10. **Provisionamento administrativo** (`npm run admin`), transacional e auditado, sem endpoint público.

Matriz de permissões: [AUTHORIZATION.md](AUTHORIZATION.md). Ambiente local, usuários e comandos: [LOCAL-DEV.md](LOCAL-DEV.md).

## Resultados

> Resultados do **lote 1**, mantidos como registro. O lote 2 refez a validação com o Compose completo e o CI: veja [Lote 2](#lote-2--validação-reproduzível).

Executado em 09/11/2026 num container Linux (Node 22.23.4, npm 10.9.9, Docker com `postgres:17` e `keycloak/keycloak:26.4`), sobre o código do commit `be4d64a9ba321b42211cbf4bed60ec67e4210c35`; commits posteriores no PR alteram só documentação.

| Verificação | Resultado |
|---|---|
| `npm ci` | Aprovado |
| `npm audit` | 0 vulnerabilidades conhecidas |
| `npm run lint` | Aprovado, sem avisos |
| `npm run build` (tsc + Vite) | Aprovado |
| `npm run db:migrate` como `vv_migrator` em banco novo e em banco com dados do ciclo 01 | Aprovado |
| `npm test` com `TEST_ADMIN_DATABASE_URL` (PostgreSQL 17 real, runtime como `vv_app`) | **36 aprovados**, 0 falhas, 0 ignorados |
| `npm test` sem banco | 21 aprovados, 1 ignorado (integração PostgreSQL) |
| `npm run test:browser` (demonstração e regressões visuais, desktop e mobile) | **32 aprovados** |
| `npm run test:e2e-real` (Keycloak + API + PostgreSQL reais) | **11 aprovados** + **1 aprovado após reinício** de PostgreSQL, Keycloak e API |
| `docker compose config` | Válido |
| Build da imagem `Dockerfile` e serviço `app`/`migrate`/`seed` dentro do Compose | **Não executado**: o build com `npm ci` falha neste container por falta de rede no build. A validação usou a opção B do [LOCAL-DEV.md](LOCAL-DEV.md) (banco e Keycloak no Compose, migração, seed e API no host) |
| CI do GitHub | Roda lint, build, migração, `npm test` com PostgreSQL e `test:browser`. **Não** roda o fluxo com Keycloak |

### O que a integração com PostgreSQL cobre (`tests/api.integration.test.ts`)

Login com `state` de uso único; só empresas autorizadas; IDs de outra organização trocados à mão (contexto, estoque, produto, movimentação, logo, histórico) → 403; CSRF ausente/errado/origem cruzada → 403; matriz de funções; SKU duplicado e cadastro idempotente; repetição da mesma movimentação, conteúdo divergente (409), resposta perdida reconciliada, conflito de versão, saldo negativo com rollback; duas sessões no mesmo produto; mais de 1.005 produtos e 205 movimentos paginados; configuração, logo e histórico isolados entre empresas; restrições do papel de runtime (sem UPDATE/DELETE em eventos e auditoria, saldo legado congelado); reinício da aplicação; expiração por inatividade e absoluta, logout e invalidação.

### Critério de aceite no navegador real (`tests/e2e-real`, capturas em `docs/review/cycle-02/`)

| Passo | Teste | Captura |
|---|---|---|
| 1. Login pelo Keycloak; nenhum token no armazenamento do navegador | `real-flow` 1 | `01-ana-overview.png` |
| 2. Só empresas autorizadas (Ana: Mercado proprietária + Adega consulta; Bruno: só Mercado) | 1, 4 | `01`, `05` |
| 3. Proprietária envia logotipo e muda a página inicial; persiste após recarregar | 2 | `02-ana-settings.png` |
| 4. Cadastro pela busca e entrada confirmada pelo servidor, com autor e horário | 3 | `03`, `04-ana-confirmed.png` |
| 5. Segunda sessão (Bruno) vê produto e movimentação; operador não cadastra (403) | 4 | `05-bruno-history.png` |
| 6. Reenviar a mesma operação não duplica; conteúdo divergente 409 | 5 | — |
| 7. Servidor rejeita outra organização e escrita sem CSRF | 6 | — |
| Resposta perdida → “Não sabemos se a operação foi registrada” → verificação | 7 | `06-bruno-unknown-outcome.png` |
| Conflito entre duas sessões orienta revisar o saldo | 8 | `07-ana-conflict.png` |
| Troca de empresa com resposta atrasada descartada; tema e função da outra empresa | 9 | `08-ana-vertice-viewer.png` |
| Outra empresa com identidade própria (Carla, Adega, escuro) | 10 | `09-carla-vertice.png` |
| Conta sem empresa | 10 | `10-eva-no-access.png` |
| Sessão expirada e logout no servidor e no provedor | 11 | `11-bruno-expired.png` |
| Reinício de PostgreSQL, Keycloak e API preserva produto, saldo e histórico | `after-restart` | `12-after-restart-history.png` |

### Teste de “zoom 200%”

A descrição foi corrigida em `tests/browser`. O que **foi** verificado: viewport de 720×500 CSS px com `deviceScaleFactor` 2, que reproduz a geometria de uma janela de 1440×1000 com zoom de 200% (sem rolagem horizontal, controles visíveis). O que **não foi** verificado: zoom real do navegador (Ctrl +), zoom só de texto e configurações de fonte mínima do sistema.

### Não executado neste ciclo

Leitores de tela, Safari e Firefox, dispositivos físicos, provedores OIDC além do Keycloak, carga/concorrência acima de duas sessões no navegador, instalação com TLS. (O build da imagem Docker, não executado no lote 1, foi executado no lote 2.)

## Lote 2 — validação reproduzível

Pedido: comprovar o conjunto instalado e executado (Compose completo, CI com OIDC real), revisar a base e corrigir problemas concretos, sem novas funcionalidades. Mesma branch `product/cycle-02` e mesmo PR #11.

### Problemas encontrados e corrigidos

| Problema | Como apareceu | Correção | Teste de regressão |
|---|---|---|---|
| **Queda do PostgreSQL derrubava a API.** Conexões ociosas do pool recebiam erro sem ouvinte (`Unhandled 'error' event`) e o processo terminava; o Compose só voltava por causa do `restart`. | Logs do Compose durante o teste de reinício | `pool.on('error')` em `apps/api/server.ts` | `scripts/compose-validate.sh` reinicia só o banco e exige o mesmo processo da API (`StartedAt` e `RestartCount` iguais) respondendo `/ready`. Falhou antes da correção, passou depois |
| **Reenvio simultâneo do mesmo cadastro virava “código duplicado”.** Duas requisições com o mesmo `id` passavam pela checagem e a segunda batia na chave primária (409 `duplicate_sku`), quebrando a idempotência prometida | Revisão de `createProduct` | Cadastros da mesma empresa serializados por advisory lock | Integração: 4 envios simultâneos → 4 × 201 e um produto; códigos que diferem só em maiúsculas → um 201 e um 409. Falhou com o lock removido |
| **Segmento exibido não acompanhava a configuração.** `/context` e `/me` liam `organizations.segment` (valor do provisionamento), e não o segmento salvo pelo proprietário | Revisão de `context`/`me` | Ambos leem o segmento da configuração versionada | Integração: proprietário muda para `bar` e `/context` e `/me` refletem |
| **Documento de permissões divergia do código.** `AUTHORIZATION.md` dizia que o gestor altera módulos; o código e a interface sempre exigiram proprietário | Conferência documento × código | Documento corrigido (módulos são identidade da empresa) | Integração: gestor alterando módulos → 403 |
| **`code` e `state` do retorno OIDC iam para o log** na URL de `/auth/callback` | Revisão do logger | Logs de `/auth/*` guardam só o caminho | `tests/api.test.ts` (`logUrl`) |
| **Build da imagem falhava atrás de proxy TLS** (lote 1 registrou como não executado) | `npm ci` sem a cadeia do proxy | Segredo de build opcional `extra_ca` (não fica na imagem); imagem única para migrate/app/seed/admin; `node --import tsx` em vez de `npx`; healthcheck `/ready` | Build e Compose executados (abaixo) |

Revisados sem alteração: cookies e CSRF (sincronizador + origem), expiração e revogação de sessão, membership por requisição, RLS e grants, validação e acesso a logotipos, configuração versionada por seção, idempotência e conflito de movimentações, descarte de respostas atrasadas na troca de empresa. Isto é uma revisão dirigida, não uma auditoria completa nem certificação.

### Comandos executados e resultados (09/11/2026, container Linux, Node 22.23.4, npm 10.9.9, Docker com `postgres:17` e `keycloak/keycloak:26.4`)

| Comando | Resultado |
|---|---|
| `docker build --secret id=extra_ca,… -t vapt-vupt-dev-app:local .` | **Aprovado** (o container de validação exige a cadeia do proxy; no GitHub o build é direto) |
| `VV_COMPOSE_CLEAN=1 VV_COMPOSE_BUILD=0 bash scripts/compose-validate.sh` | **Aprovado** do zero: serviços prontos em ~25 s; migração 001+002 e grants; seed duas vezes sem duplicar; `provision` documentado; `/health`, `/ready`, `/`, `/demo`, `/app` = 200; `/api/session` = 401; emissor `http://localhost:8080/realms/vapt` igual para navegador e API (rede interna `keycloak:8080`); redirect com `redirect_uri`, PKCE S256, `state`, `nonce`; `vv_runtime`/`vv_migrator`/`vv_app` sem superusuário nem BYPASSRLS, tabelas do `vv_migrator`, API conectada só como `vv_runtime`; API sobrevive ao reinício do banco; API **não inicia** sem `OIDC_CLIENT_SECRET` nem com o papel dono das tabelas |
| `npm run test:e2e-real` contra o Compose (reinício por `docker compose restart postgres keycloak app`) | **12 aprovados + 1 aprovado após o reinício** |
| `TEST_ADMIN_DATABASE_URL=… npm test` (PostgreSQL 17 real, runtime como `vv_app`) | **39 aprovados**, 0 ignorados |
| `npm test` sem banco | 22 aprovados, 1 ignorado (integração) |
| `npm run lint`, `npm run build` | Aprovados |
| `npm run test:browser` | **32 aprovados** |
| CI no GitHub (`check` + novo `e2e-real`) | **Aprovados** na [execução 42610182264](https://github.com/jotape2709/vapt-vupt/actions/runs/42610182264) (commit `b7a48ad`): `e2e-real` construiu o Compose do zero, passou em `compose-validate.sh`, 12 testes no navegador + 1 após reinício; logs dos serviços e capturas publicados como artefato `e2e-real-results`. Execuções dos commits seguintes ficam na aba Checks do PR #11 |

### Evidências de persistência e isolamento

- Duas empresas com identidades distintas (Mercado Aurora azul com logo próprio; Adega Vértice marinho e escura) e cinco pessoas com funções diferentes (`tests/e2e-real`, capturas `01`–`10`).
- Alterar a configuração da empresa A deixa a B com a mesma versão e o mesmo conteúdo (e2e passo 2 e integração “personalização não concede acesso”).
- Personalização não concede acesso: Ana continua consulta na Adega; esconder um módulo não muda permissões; campos de função na configuração são recusados (400).
- Produto, saldo e histórico iguais depois de reiniciar PostgreSQL, Keycloak e API (`after-restart`, captura `12`); a API não cai quando só o banco reinicia.
- Celular: operador entra pelo Keycloak e abre o registro em 390 px sem rolagem horizontal (captura `10b-bruno-mobile-form.png`).

### Desenvolvimento × piloto local

O `compose.yaml` continua sendo **apenas de desenvolvimento**. Falta para um piloto instalado numa loja:

1. **TLS e certificados**: proxy reverso com HTTPS para a aplicação e o provedor de identidade, nomes internos, cadeia confiável instalada nos dispositivos, renovação e alerta de expiração. Com `APP_ORIGIN` HTTPS os cookies passam a `Secure`/`__Host-` e `TRUST_PROXY=true` deve ser usado só atrás desse proxy.
2. **Provedor de identidade de produção**: Keycloak em modo `start` (não `start-dev`) com banco próprio, ou provedor gerenciado; segredo do cliente fora do repositório; política de senha/MFA definida com o operador; back-channel logout se a revogação imediata for exigida.
3. **Segredos**: senhas de `vv_migrator`, `vv_runtime`, administrador do Keycloak e segredo OIDC gerados por instalação e guardados fora do repositório (arquivo de ambiente protegido ou cofre).
4. **Backup e restauração**: `pg_dump`/backup físico agendado e criptografado, cópia fora da máquina, retenção definida, **ensaio de restauração** documentado; definir RPO/RTO com o operador.
5. **Atualização e reversão**: imagem construída uma vez e fixada por digest; migrações aplicadas com backup prévio; procedimento de reversão (a migração 002 é aditiva, mas não há script de volta); janela de manutenção.
6. **Operação**: imagem de produção sem dependências de desenvolvimento e sem `tsx`; logs com rotação; monitoramento de `/ready`; rate limit compartilhado se houver mais de uma instância.
7. **Processo**: gestão de equipe e acessos pela interface (próximo lote funcional), termo de uso de dados e revisão LGPD antes de dados pessoais reais.

### Inventário de branches (nenhuma excluída)

| Branch | Situação |
|---|---|
| `main` | Base (`950ac12`, merge do PR #10) |
| `product/cycle-02` | Esta entrega, PR #11 |
| `next/product-cycle-01` | Integrada à main pelo PR #10 |
| `fix/blue-ribbon-responsive` | Integrada à main (nenhum commit fora dela) |
| `claude/project-thread-bt0ash`, `claude/project-thread-pvoay1` | Sem commits fora da main (ponteiros antigos de sessões) |
| `next/foundation-product` | **6 commits fora da main e do ciclo 02** (`f40d637`…`b4ed4c0`). Linha paralela anterior: SPA pública com tokens no navegador, `ConnectedApp`, migração `002_identity_directory.sql` (conflita com a numeração da 002 atual) e arquivos de contexto para agentes. **Superada** pelo BFF do ciclo 02; não integrada. A ideia de `031f84f` (não sobrescrever saldo mais novo com a resposta de um reenvio) já é atendida aqui: após confirmar, a interface recarrega as listas do servidor |

### Limitações e problemas ainda abertos

- O CI usa as credenciais descartáveis de exemplo do Compose e do realm local; não há segredos do GitHub envolvidos.
- Ver também [Limitações](#limitações). Nada de PWA/offline, câmeras, IA, fiscal, POS, compras, várias unidades ou novos módulos foi iniciado.

## Limitações

- Uma unidade por empresa; sem transferência, saldo consolidado ou escolha de unidade.
- Quantidades inteiras (inclusive kg/L).
- Sem convites, gestão de membros ou criação de empresas pela interface (só comando administrativo).
- Sem back-channel logout do provedor; rate limit em memória de um processo.
- A tela de outra sessão não se atualiza sozinha: Ana só vê a mudança de Bruno ao recarregar a lista ou ao receber o conflito.
- O logotipo do tema v1 não é migrado.
- `compose.yaml` é só de desenvolvimento; não há backup, TLS, observabilidade nem imagem fixada por digest.
- `/app` no deploy estático da Vercel (só frontend) não funciona, porque lá não há API: mostra uma tela de erro. A demonstração `/demo` continua funcionando.

## Próximos contratos (registrados, não implementados)

- **Offline/PWA**: fila local por organização/usuário/dispositivo reaproveitando `eventId` + `expectedVersion`; `GET /movements/:eventId` já é o endpoint de reconciliação. Exige política de dados locais no logout e por função (ADR 005).
- **POS**: `POST /orgs/:orgId/units/:unitId/movements` com `kind: issue` e motivo de venda é o ponto de integração; vendas precisarão de documento próprio que gere movimentações na mesma transação.
- **Compras e cotações**: fornecedores e pedidos como agregados próprios; recebimento gera `receipt` com referência ao pedido.
- **Fiscal**: fora do domínio de estoque; adaptador externo, sem emissão fictícia.
- **Várias unidades**: remover o índice único parcial de `is_primary` como única unidade, adicionar seleção de unidade ativa ao contexto e transferências com duas pernas.

## Registro de passagem

### Lote 1 — concluído para revisão (Claude, 09/11/2026)

- Responsável: Claude. Estado: **pronto para revisão**; PR #11 em rascunho, sem merge.
- Entregue: itens 1 a 8 do escopo, com os resultados acima.
- Para revisar primeiro: `db/migrations/002_operations.sql`, `db/grants/runtime.sql`, `apps/api/app.ts` (sessão/CSRF), `apps/api/operations.ts` (`move`, `updateSettings`), `apps/web/forms.tsx` (resultado desconhecido) e `apps/web/RealApp.tsx`.
- Para reproduzir: [LOCAL-DEV.md](LOCAL-DEV.md).
- Próximo passo sugerido, só após revisão: convites e gestão de membros na interface, depois várias unidades. Nada disso foi iniciado.

### Lote 2 — validação reproduzível, pronto para revisão (Claude, 09/11/2026)

- Mesma branch `product/cycle-02` e mesmo PR #11; nenhuma branch ou PR novo, nenhum merge, nenhuma branch excluída.
- Entregue: 5 correções com regressão, build da imagem, Compose validado do zero, job `e2e-real` no CI com Keycloak real, isolamento A/B e celular no e2e, requisitos do piloto e inventário de branches (seção [Lote 2](#lote-2--validação-reproduzível)).
- Próximo lote funcional, após revisão: gestão de equipe e acessos pela interface. Não iniciado.
