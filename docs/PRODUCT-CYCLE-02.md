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

Leitores de tela, Safari e Firefox, dispositivos físicos, provedores OIDC além do Keycloak, carga/concorrência acima de duas sessões no navegador, build da imagem Docker, instalação com TLS.

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
