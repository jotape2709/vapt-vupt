# Mapa dos fontes — gerado

Gerado por `npm run context:snapshot`. Não edite manualmente. Digest: `1c66081ad305ba6327e220d0680b412156b8f5a77215b0a23af9cabef2a7b112`. `npm run context:check` detecta alterações, adições e remoções no corpus permitido. Não usa o SHA do commit para evitar autorreferência.

Estado: [PROJECT_STATE.md](PROJECT_STATE.md) · Tarefas: [NEXT_TASKS.md](NEXT_TASKS.md) · Uso: [START_HERE.md](START_HERE.md)

## raiz

| Arquivo | Linhas | Seções / identificadores (aproximação) |
|---|---:|---|
| [.gitignore](../../.gitignore) | 11 | .gitignore |
| [AGENTS.md](../../AGENTS.md) | 47 | Vapt-Vupt Next — instruções de projeto; Vapt-Vupt Next — instruções de projeto > Comece aqui; Vapt-Vupt Next — instruções de projeto > Produto e decisões do responsável; Vapt-Vupt Next — instruções de projeto > Limites que não podem desaparecer; Vapt-Vupt Next — instruções de projeto > Fluxo de alteração; Vapt-Vupt Next — instruções de projeto > Comandos |
| [CLAUDE.md](../../CLAUDE.md) | 8 | Entrada para Claude Code |
| [LICENSE](../../LICENSE) | 22 | LICENSE |
| [README.md](../../README.md) | 112 | Vapt-Vupt Next; Vapt-Vupt Next > O que existe nesta branch; Vapt-Vupt Next > Desenvolvimento; Vapt-Vupt Next > API, identidade e banco; Vapt-Vupt Next > Arquitetura; Vapt-Vupt Next > Testes e limites |
| [eslint.config.js](../../eslint.config.js) | 18 | eslint.config.js |
| [package-lock.json](../../package-lock.json) | 4335 |  |
| [package.json](../../package.json) | 60 | package.json |
| [playwright.config.ts](../../playwright.config.ts) | 25 | playwright.config.ts |
| [playwright.connected.config.ts](../../playwright.connected.config.ts) | 29 | playwright.connected.config.ts |
| [tsconfig.json](../../tsconfig.json) | 17 | tsconfig.json |
| [vercel.json](../../vercel.json) | 35 | vercel.json |
| [vite.config.ts](../../vite.config.ts) | 8 | vite.config.ts |

## apps

| Arquivo | Linhas | Seções / identificadores (aproximação) |
|---|---:|---|
| [apps/api/app.ts](../../apps/api/app.ts) | 107 | apps/api/app.ts; Data; buildApi; app; header; params |
| [apps/api/identity.ts](../../apps/api/identity.ts) | 19 | apps/api/identity.ts; tokenVerifier |
| [apps/api/migrate.ts](../../apps/api/migrate.ts) | 43 | apps/api/migrate.ts; connectionString; pool; db; exists |
| [apps/api/repository.ts](../../apps/api/repository.ts) | 190 | apps/api/repository.ts; Product; MovementInput; Role; Theme; AccessError |
| [apps/api/server.ts](../../apps/api/server.ts) | 46 | apps/api/server.ts; required; value; issuer; jwksUrl; jwks |
| [apps/web/App.tsx](../../apps/web/App.tsx) | 1035 | apps/web/App.tsx; Product; Theme; labels; planned; moneyless |
| [apps/web/ConnectedApp.tsx](../../apps/web/ConnectedApp.tsx) | 694 | apps/web/ConnectedApp.tsx; Organization; StockProduct; StockRecord; ConnectedApp; generation |
| [apps/web/Landing.tsx](../../apps/web/Landing.tsx) | 179 | apps/web/Landing.tsx; Landing |
| [apps/web/api-client.ts](../../apps/web/api-client.ts) | 105 | apps/web/api-client.ts; MovementInput; Product; ApiError; OrganizationSchema; Organization |
| [apps/web/auth.ts](../../apps/web/auth.ts) | 70 | apps/web/auth.ts; authority; clientId; authConfigured; identityClient; startSignIn |
| [apps/web/components.tsx](../../apps/web/components.tsx) | 91 | apps/web/components.tsx; Mark; Icon; paths; Dialog; ref |
| [apps/web/demo.ts](../../apps/web/demo.ts) | 164 | apps/web/demo.ts; Theme; Product; DemoMovement; Business; product |
| [apps/web/env.d.ts](../../apps/web/env.d.ts) | 2 | apps/web/env.d.ts |
| [apps/web/main.tsx](../../apps/web/main.tsx) | 10 | apps/web/main.tsx |
| [apps/web/pending-operation.ts](../../apps/web/pending-operation.ts) | 34 | apps/web/pending-operation.ts; ReceiptSchema; PendingOperation; Store; key; savePending |
| [apps/web/styles.css](../../apps/web/styles.css) | 1618 | apps/web/styles.css |

## packages

| Arquivo | Linhas | Seções / identificadores (aproximação) |
|---|---:|---|
| [packages/domain/index.ts](../../packages/domain/index.ts) | 70 | packages/domain/index.ts; modules; ThemeSchema; Theme; ProductSchema; Product |

## db

| Arquivo | Linhas | Seções / identificadores (aproximação) |
|---|---:|---|
| [db/migrations/001_core.sql](../../db/migrations/001_core.sql) | 61 | db/migrations/001_core.sql |
| [db/migrations/002_identity_directory.sql](../../db/migrations/002_identity_directory.sql) | 27 | db/migrations/002_identity_directory.sql |

## tests

| Arquivo | Linhas | Seções / identificadores (aproximação) |
|---|---:|---|
| [tests/api.test.ts](../../tests/api.test.ts) | 107 | tests/api.test.ts; org; repo; api; r; denied |
| [tests/browser/demo.spec.ts](../../tests/browser/demo.spec.ts) | 154 | tests/browser/demo.spec.ts; errors; selector; overflow; raw |
| [tests/connected/access.spec.ts](../../tests/connected/access.spec.ts) | 229 | tests/connected/access.spec.ts; org; productId; fixture; pair; jwk |
| [tests/database.test.ts](../../tests/database.test.ts) | 143 | tests/database.test.ts; adminUrl; admin; orgA; identity; r |
| [tests/domain.test.ts](../../tests/domain.test.ts) | 53 | tests/domain.test.ts; event; theme |
| [tests/identity.test.ts](../../tests/identity.test.ts) | 49 | tests/identity.test.ts; key; jwk; verify; sign; other |
| [tests/pending-operation.test.ts](../../tests/pending-operation.test.ts) | 43 | tests/pending-operation.test.ts; entries; store; op |

## scripts

| Arquivo | Linhas | Seções / identificadores (aproximação) |
|---|---:|---|
| [scripts/project-context.mjs](../../scripts/project-context.mjs) | 554 | scripts/project-context.mjs; ROOT; SNAPSHOT; MAP; sha; order |
| [scripts/project-context.test.mjs](../../scripts/project-context.test.mjs) | 161 | scripts/project-context.test.mjs; root; outside; paths; first; result |

## docs

| Arquivo | Linhas | Seções / identificadores (aproximação) |
|---|---:|---|
| [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md) | 50 | Arquitetura e decisões; Arquitetura e decisões > ADR 001 — Monorepositório pequeno; Arquitetura e decisões > ADR 002 — Demo e operação são ambientes distintos; Arquitetura e decisões > ADR 003 — Tenant e permissões; Arquitetura e decisões > ADR 004 — Movimentações; Arquitetura e decisões > ADR 005 — Offline e intranet (fase D bloqueada) |
| [docs/AUDIT.md](../../docs/AUDIT.md) | 35 | Auditoria inicial — 6 de novembro de 2026; Auditoria inicial — 6 de novembro de 2026 > Organização e desempenho; Auditoria inicial — 6 de novembro de 2026 > Reaproveitamento; Auditoria inicial — 6 de novembro de 2026 > Limites da auditoria |
| [docs/BRAND.md](../../docs/BRAND.md) | 24 | Identidade — VV em movimento; Identidade — VV em movimento > Versão dos tokens |
| [docs/CONNECTED_ACCESS.md](../../docs/CONNECTED_ACCESS.md) | 36 | Acesso conectado — configuração e limites; Acesso conectado — configuração e limites > Configurar uma instalação de desenvolvimento; Acesso conectado — configuração e limites > Fluxos implementados; Acesso conectado — configuração e limites > Limites desta entrega; Acesso conectado — configuração e limites > Testar o fluxo sem credenciais reais |
| [docs/DELIVERY.md](../../docs/DELIVERY.md) | 46 | Continuação — 08/11/2026; Continuação — 08/11/2026 > Histórico da entrega inicial; Entrega inicial — Vapt-Vupt Next; Entrega inicial — Vapt-Vupt Next > A — Auditoria e fundação; Entrega inicial — Vapt-Vupt Next > B — Produto e identidade; Entrega inicial — Vapt-Vupt Next > C — Fundação parcial |
| [docs/SECURITY.md](../../docs/SECURITY.md) | 32 | Segurança e operação; Segurança e operação > Instalação local futura; Segurança e operação > LGPD e revisão; Segurança e operação > Evidência de testes desta entrega |
| [docs/VALIDATION.md](../../docs/VALIDATION.md) | 85 | Validação da continuação — 08/11/2026; Validação da continuação — 08/11/2026 > Histórico da primeira entrega; Registro de validação — 6 de novembro de 2026; Registro de validação — 6 de novembro de 2026 > Resultado verificado; Registro de validação — 6 de novembro de 2026 > Falhas encontradas e corrigidas; Registro de validação — 6 de novembro de 2026 > Ambiente e limitações |
| [docs/context/NEXT_TASKS.md](../../docs/context/NEXT_TASKS.md) | 36 | Próximas entregas — backlog acionável; Próximas entregas — backlog acionável > 1. Homologar identidade e instalação da fase C; Próximas entregas — backlog acionável > 2. Provisionamento seguro e gestão de organizações/equipe; Próximas entregas — backlog acionável > 3. Personalização conectada, paginação e UX; Próximas entregas — backlog acionável > 4. Preparar e implementar fase D; Próximas entregas — backlog acionável > 5. Evolução operacional da fase E |
| [docs/context/PROJECT_STATE.md](../../docs/context/PROJECT_STATE.md) | 66 | Estado do Vapt-Vupt Next; Estado do Vapt-Vupt Next > Missão e público; Estado do Vapt-Vupt Next > O que funciona na demonstração; Estado do Vapt-Vupt Next > O que está implementado na área conectada; Estado do Vapt-Vupt Next > O que ainda não está liberado ou implementado; Estado do Vapt-Vupt Next > Evidência de validação da base |
| [docs/context/RETRIEVAL_DESIGN.md](../../docs/context/RETRIEVAL_DESIGN.md) | 47 | Recuperação de contexto: escolha técnica e limites; Recuperação de contexto: escolha técnica e limites > O que foi implementado; Recuperação de contexto: escolha técnica e limites > Relação com o STAIR da IBM; Recuperação de contexto: escolha técnica e limites > Atualização e proveniência; Recuperação de contexto: escolha técnica e limites > Escopo e dados; Recuperação de contexto: escolha técnica e limites > Entradas das ferramentas |
| [docs/context/START_HERE.md](../../docs/context/START_HERE.md) | 75 | Continue o projeto com Claude ou Antigravity; Continue o projeto com Claude ou Antigravity > Clone a branch com a reconstrução; Continue o projeto com Claude ou Antigravity > Abra com o agente; Continue o projeto com Claude ou Antigravity > Monte o contexto da tarefa; Continue o projeto com Claude ou Antigravity > Primeiro pedido sugerido ao agente; Continue o projeto com Claude ou Antigravity > Atualização durante o trabalho |
| [docs/context/TOPICS.json](../../docs/context/TOPICS.json) | 115 | docs/context/TOPICS.json |

## public

| Arquivo | Linhas | Seções / identificadores (aproximação) |
|---|---:|---|
| [public/brand/symbol-mono.svg](../../public/brand/symbol-mono.svg) | 1 | public/brand/symbol-mono.svg |
| [public/brand/symbol-reverse.svg](../../public/brand/symbol-reverse.svg) | 1 | public/brand/symbol-reverse.svg |
| [public/brand/symbol.svg](../../public/brand/symbol.svg) | 1 | public/brand/symbol.svg |
| [public/brand/wordmark.svg](../../public/brand/wordmark.svg) | 1 | public/brand/wordmark.svg |

## .agents

| Arquivo | Linhas | Seções / identificadores (aproximação) |
|---|---:|---|
| [.agents/rules/vapt-vupt.md](../../.agents/rules/vapt-vupt.md) | 9 | .agents/rules/vapt-vupt.md |

## .github

| Arquivo | Linhas | Seções / identificadores (aproximação) |
|---|---:|---|
| [.github/workflows/next-checks.yml](../../.github/workflows/next-checks.yml) | 53 | .github/workflows/next-checks.yml |

O parser usa títulos Markdown e assinaturas reconhecíveis, não análise semântica completa. node_modules, legacy, segredos/ambiente, symlinks externos, build e caches ficam fora. package-lock entra somente no controle de hashes.
