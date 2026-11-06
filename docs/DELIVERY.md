# Entrega inicial — Vapt-Vupt Next

Branch: next/foundation-product. Sem merge na main. Código original e licença preservados.

## A — Auditoria e fundação

Criados docs/AUDIT.md, ARCHITECTURE.md e SECURITY.md. Arquivados index.html, vapt-vupt.html, css/styles.css, js/app.js e img/favicon.svg em legacy/. CSS, JS, HTML monolítico e favicon antigos saíram do caminho da aplicação; permanecem recuperáveis no histórico.

## B — Produto e identidade

Criados apps/web/main.tsx, App.tsx, Landing.tsx, components.tsx, demo.ts e styles.css. Substituído index.html. Criados public/brand/symbol.svg, symbol-mono.svg, symbol-reverse.svg e wordmark.svg. Criado docs/BRAND.md.

Três demos: Mercado Aurora (floresta), Adega Vértice (vinho/escuro) e Bar da Esquina (terracota/compacto). Cadastro, busca, filtros, movimentações e personalização por empresa. Novo ambiente via onboarding local. Compras, cotações e equipe explicitamente planejados.

## C — Fundação parcial

Criados packages/domain/index.ts; apps/api/app.ts, repository.ts, server.ts e migrate.ts; db/migrations/001_core.sql e .env.example. Validação de token OIDC, membership, RLS, contratos, transação de estoque, idempotência, conflitos e auditoria. Papel privilegiado é rejeitado ao iniciar o servidor. UI ainda não usa API e login real ainda não foi integrado.

## Ferramentas e validação

Criados package.json, tsconfig.json, vite.config.ts, eslint.config.js, playwright.config.ts, .gitignore, vercel.json, .github/workflows/next-checks.yml, tests/domain.test.ts, api.test.ts, database.test.ts e browser/demo.spec.ts. README.md reescrito. docs/VALIDATION.md registra resultados por execução.

A configuração Vercel serve somente dist/, com headers explícitos. A integração já existente gera prévia da branch; isso não promove a versão à produção.

## Pendências deliberadas

Sem fase D/E: PWA, instalação offline/intranet pronta, fila de sincronização, Docker Compose, autenticação de ponta a ponta, gerenciamento central, armazenamento comercial de logos, compras reais, POS e previsão de reposição. Quantidades fracionárias e estoque por unidade não são anunciados. Não confundir screenshots gerados por CI com revisão visual humana completa.

package-lock.json foi acrescentado com as versões testadas; CI usa npm ci. LICENSE não foi alterada. Não foi aberta pull request nem feito merge.
