# Vapt-Vupt

Uma nova base de gestão para mercados, adegas, bares e pequenos estabelecimentos. Reconstrução progressiva do projeto acadêmico Vapt-Vupt, com foco em clareza operacional, identidade por empresa e fundamentos seguros.

**Estado: desenvolvimento. Não pronto para produção.** A interface é uma demonstração local com empresas fictícias. A API é uma fundação independente, ainda não conectada à interface. Não há clientes, indicadores comerciais ou conformidade certificada anunciados.

## O que existe hoje

| Experiência | Estado real |
|---|---|
| Site público e nova identidade VV | Código React/CSS e ativos SVG |
| Mercado Aurora, Adega Vértice, Bar da Esquina | Empresas fictícias com catálogos e temas distintos |
| Busca, filtros, cadastro de produtos, entradas/saídas | Funcionais na demonstração local: busca sem acento, cadastro a partir da busca, entrada/saída por produto com prévia do saldo |
| Histórico de movimentações | Salvo no navegador com os saldos (últimos 200 por empresa), com saldo antes/depois; não é trilha de auditoria |
| Nome, logo, paleta, claro/escuro, densidade, fonte, módulos | Preferências por empresa no navegador; prévia e salvamento |
| Onboarding | Cria ambiente fictício local, sem conta comercial |
| Compras, cotações e equipe | Estados explicativos; nenhuma operação externa |
| API Fastify e PostgreSQL | Código de autenticação por token OIDC, membership, RLS, produtos, tema, movimentações, auditoria |
| Login/UI integrada, organização via API, administração central | Ainda não implementados |
| GTIN, embalagens, lotes, validade, depósitos, POS | Planejados |
| PWA instalável, cache, fila IndexedDB, Docker/intranet pronta | Não implementados; fase D depende da conclusão da base C |

## Desenvolvimento

Node.js 22.12+ e npm.

```bash
git clone https://github.com/jotape2709/vapt-vupt.git
cd vapt-vupt
npm ci
npm run dev
```

Abra o endereço local informado pelo Vite e entre em **Explorar demonstração**. Nenhuma credencial é solicitada. Roteiro sugerido para o mercado demonstrativo:

1. Em **Estoque**, busque um produto que não existe e use **Cadastrar “termo”**.
2. Na confirmação, use **Registrar entrada**; confira a prévia do saldo e registre.
3. Confira o novo saldo na tabela e use **Ver histórico**.
4. Troque de empresa no seletor e alterne claro/escuro. Em Personalização, **Restaurar dados de exemplo** volta ao início.

```bash
npm run lint
npm run build
npm test
npm run test:browser   # Playwright; requer `npx playwright install chromium` uma vez
npm run preview
```

Em ambientes com Chromium já instalado (sem download), defina `PLAYWRIGHT_CHROMIUM_PATH` com o caminho do executável.

O build publica somente index.html transformado, código compilado e public/. Não sirva a raiz do repositório: legacy/ contém código antigo inseguro e é apenas referência histórica.

**Dependências:** `package-lock.json` está versionado e foi validado com `npm ci` (Node 22, npm 10.9). O CI instala com `npm ci` e publica `npm audit --json`; em 09/11/2026 o relatório local indicou 0 vulnerabilidades conhecidas, o que não substitui uma análise de dependências completa.

## API e banco — desenvolvimento separado

1. Provisione PostgreSQL e um provedor OIDC confiável.
2. Crie uma conta de migração e outra de runtime, sem superusuário ou bypass RLS.
3. Copie .env.example para .env e substitua os placeholders. Os comandos não carregam .env automaticamente; exporte as variáveis no processo ou use o suporte --env-file do runtime.
4. Execute `npm run db:migrate` com MIGRATION_DATABASE_URL. A migration é transacional e registra versão.
5. Aplique os grants comentados em db/migrations/001_core.sql ao papel real.
6. Provisione organização, unidade e membership via administração do banco. **Não há endpoint público de cadastro de organizações nesta fase.**
7. Execute `npm run dev:api` com DATABASE_URL, OIDC_ISSUER, OIDC_AUDIENCE e OIDC_JWKS_URL configurados.

A API falha ao iniciar se configuração de identidade estiver ausente. /health mede somente o processo. Rotas sob /api/organizations/:orgId exigem Bearer OIDC válido e membership. GET/POST products, PUT theme e POST movements estão definidos. Movimentação exige UUID de evento, produto, expectedVersion, kind, quantity inteira e reason. Conflitos retornam 409; nenhuma correção silenciosa.

## Arquitetura

- apps/web: React, TypeScript e Vite; site e demo na mesma base (App, pages, forms, components, inventory, demo).
- apps/api: Fastify, jose, PostgreSQL; validação Zod, headers e rate limiting.
- packages/domain: contratos de tema, produto, movimentação e políticas.
- db/migrations: SQL versionado, RLS e chaves por organização.
- tests: testes de domínio, regras de estoque da demo, API, integração com banco descartável e navegador (tests/browser).
- docs: auditoria, decisões, identidade, segurança e validação.
- legacy: versão acadêmica preservada, fora do build.

## Testes e limites

`npm test` roda testes unitários/API e **pula integração PostgreSQL** se TEST_ADMIN_DATABASE_URL não estiver definida. A integração cria papel e dados: só executar em banco descartável recém-migrado, nunca num banco de produção. O workflow Vapt-Vupt checks (.github/workflows/checks.yml) roda em PRs para a main com PostgreSQL efêmero: `npm ci`, audit, lint, build, migration, testes e testes de navegador.

Veja [docs/VALIDATION.md](docs/VALIDATION.md) e [docs/UX-CYCLE-01.md](docs/UX-CYCLE-01.md) para distinguir checks escritos de resultados realmente executados. Código e testes escritos não equivalem a testes aprovados.

## Segurança e dados

Demo usa localStorage apenas para preferências e dados fictícios, não como autenticação. Não inserir dados pessoais reais. Tema não controla autorização. API valida tokens via provedor externo e membership no banco; RLS depende de papel configurado corretamente. Eventos têm idempotência e controle de versão. Histórico demo fica no navegador e não é trilha de auditoria. Estoque por unidade, quantidades fracionárias e armazenamento comercial de logos ainda pendentes.

Leia [Segurança](docs/SECURITY.md), [Arquitetura](docs/ARCHITECTURE.md), [Auditoria](docs/AUDIT.md) e [Identidade](docs/BRAND.md).

## Roadmap

- A: auditoria, separação do legado, contratos, migrations e testes; validação executável pendente.
- B: nova identidade e experiência demonstrativa; ciclo 01 refinou o fluxo de estoque (docs/UX-CYCLE-01.md). Auditoria com leitor de tela e Safari/Firefox pendentes.
- C: integrar UI/OIDC/API, onboarding seguro, gestão de membros, administração central, logos e persistência; validar isolamento e concorrência.
- D: PWA, política offline, IndexedDB, conflitos, servidor intranet, TLS, backups, atualização e ensaios de restauração.
- E: fornecedores, compras/cotações reais, POS, rastreabilidade e inteligência com dados reais.

Nenhum deploy público de produção deve ocorrer sem autorização do responsável.

## Licença e origem

Originado como projeto acadêmico de João Pedro, em 2026. A versão original permanece no histórico e em legacy/. [LICENSE](LICENSE) mantém integralmente a licença MIT e Copyright (c) 2026 João Pedro. A evolução comercial não revoga direitos concedidos anteriormente; mantenha aviso de copyright e licença em cópias ou partes substanciais.
