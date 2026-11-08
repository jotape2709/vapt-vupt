# Continuação — 08/11/2026

Identidade alterada para azul Royal, Marinho e Atlântico no site, tokens, SVGs, favicon e temas das três empresas. Contrato de tema v2; migração preserva os dados da demo e migration 002 atualiza configurações existentes no banco.

A área /app usa oidc-client-ts com Code + PKCE, tokens só em memória e lista de empresas autorizadas pela API. Catálogo, cadastro de produtos, entradas/saídas e histórico conectado têm telas próprias. Recibo de envio em sessionStorage, separado por issuer/subject, mantém UUID/payload para verificar perda de resposta. Não é uma fila offline.

Arquivos novos: apps/api/identity.ts; apps/web/ConnectedApp.tsx, auth.ts, api-client.ts, pending-operation.ts, env.d.ts; db/migrations/002_identity_directory.sql; tests/identity.test.ts, pending-operation.test.ts, connected/access.spec.ts; playwright.connected.config.ts; docs/CONNECTED_ACCESS.md.

Arquivos principais alterados: App.tsx, Landing.tsx, demo.ts, styles.css, packages/domain/index.ts, API app/repository/server/migrate, testes existentes, package.json/lock, README, documentação, Vite, Vercel, workflow e ativos de marca. Os fontes também foram formatados para revisão e manutenção.

Resultados em VALIDATION.md. Fase C ainda parcial: integração com provedor real, onboarding comercial, membros, tema conectado completo, logos remotos e administração central pendentes. Fases D/E não executadas. Sem merge ou deploy de produção.

---

## Histórico da entrega inicial

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
