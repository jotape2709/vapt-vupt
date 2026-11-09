# Vapt-Vupt

Uma nova base de gestão para mercados, adegas, bares e pequenos estabelecimentos. Reconstrução progressiva do projeto acadêmico Vapt-Vupt, com foco em clareza operacional, identidade por empresa e fundamentos seguros.

**Estado: piloto em desenvolvimento. Não pronto para produção.** O ciclo 02 conectou a interface à API: login OIDC, empresas autorizadas, configuração, catálogo, entradas/saídas, saldo e histórico ficam no PostgreSQL. A demonstração pública continua separada, com empresas fictícias no navegador. Não há clientes, indicadores comerciais ou conformidade certificada anunciados.

## O que existe hoje

| Experiência | Estado real |
|---|---|
| Site público e identidade VV (azul) | React/CSS e ativos SVG |
| Demonstração em `/demo` | Mercado Aurora, Adega Vértice e Bar da Esquina fictícios, salvos só no navegador; sandbox separada da operação real |
| Operação real em `/app` | Login OIDC (Keycloak no ambiente local), sessão de servidor com cookie HttpOnly, CSRF, expiração e logout |
| Empresas e funções | Decididas pelo servidor (membership no PostgreSQL + RLS); proprietário, gestor, operador e consulta ([matriz](docs/AUTHORIZATION.md)) |
| Configuração da empresa | Versionada no servidor: nome, segmento, logotipo validado, paleta, módulos, navegação, visão geral; modelos de mercado, adega e bar |
| Catálogo, saldo e histórico | Busca e paginação no servidor; saldo por unidade com versão; movimentações idempotentes, com autor e horário do servidor, sem edição direta do saldo |
| Unidades | Piloto com uma unidade por empresa, mostrada na interface |
| Provisionamento | Comando administrativo auditado (`npm run admin`); não há cadastro público de empresas nem convites |
| Compras, cotações, equipe, POS, fiscal | Não implementados; a interface só explica o que está planejado |
| PWA, offline, câmera, IA | Não implementados |

## Começar

Node.js 22.12+ e npm.

```bash
git clone https://github.com/jotape2709/vapt-vupt.git
cd vapt-vupt
npm ci
npm run dev        # site e demonstração (/demo), sem servidor
```

Para a operação real com PostgreSQL e Keycloak locais, siga [docs/LOCAL-DEV.md](docs/LOCAL-DEV.md):

```bash
docker compose up -d --build
docker compose --profile tools run --rm seed
# http://localhost:3001/app  — usuários ana, bruno, carla, davi, eva (senhas no guia)
```

O `compose.yaml` é **apenas para desenvolvimento** (HTTP, senhas de exemplo, Keycloak em modo dev).

## Verificações

```bash
npm run lint
npm run build
npm test                 # integração PostgreSQL só roda com TEST_ADMIN_DATABASE_URL (banco descartável)
npm run test:browser     # demonstração e regressões visuais (Playwright)
npm run test:e2e-real    # fluxo real contra o ambiente local, com reinício dos serviços
```

Em ambientes com Chromium já instalado, defina `PLAYWRIGHT_CHROMIUM_PATH`. O workflow `.github/workflows/checks.yml` roda `npm ci`, audit, lint, build, migração, `npm test` com PostgreSQL efêmero e `test:browser`. O fluxo real com Keycloak (`test:e2e-real`) **não** roda no CI. Resultados realmente executados ficam em [docs/VALIDATION.md](docs/VALIDATION.md) e [docs/PRODUCT-CYCLE-02.md](docs/PRODUCT-CYCLE-02.md).

O build publica somente o `index.html` transformado, o código compilado e `public/`. Não sirva a raiz do repositório: `legacy/` contém o código acadêmico antigo, inseguro, mantido só como referência.

## Arquitetura

- `apps/web`: React + TypeScript + Vite. Site (`/`), demonstração (`/demo`, `DemoGateway` em localStorage) e operação real (`/app`, `ApiGateway`), com o mesmo `Workspace`.
- `apps/api`: Fastify como BFF. OIDC (`openid-client`), sessões, CSRF, rotas `/api/orgs/:orgId/...`, logotipos, serve o build do frontend no mesmo domínio. `admin-cli.ts` para provisionamento.
- `packages/domain`: contratos Zod compartilhados (`contracts.ts`), matriz de permissões, modelos de segmento.
- `db/migrations` e `db/grants`: SQL versionado (001 do ciclo anterior, intocado; 002 aditiva com migração dos dados) e grants mínimos do runtime.
- `tests`: unidade, API, integração com PostgreSQL real e papel restrito, navegador (demo) e `tests/e2e-real` (fluxo real).
- `docs`: [autenticação](docs/AUTH.md), [permissões](docs/AUTHORIZATION.md), [ambiente local](docs/LOCAL-DEV.md), [arquitetura](docs/ARCHITECTURE.md), [segurança](docs/SECURITY.md), [ciclo 02](docs/PRODUCT-CYCLE-02.md).

## Segurança e dados

Tokens nunca chegam ao navegador; a sessão é um cookie opaco HttpOnly com hash no banco. O servidor confere membership e função a cada operação e a RLS filtra por empresa com um papel sem privilégios. Movimentações e auditoria são append-only. A demonstração usa localStorage só para dados fictícios e nunca envia nada à API. Não insira dados pessoais reais em ambientes de desenvolvimento. Leia [Segurança](docs/SECURITY.md).

## Roadmap

- A–B: auditoria, contratos, nova identidade e demonstração (ciclos anteriores e ciclo 01).
- C: **ciclo 02** entregou o fluxo real ponta a ponta. Pendentes: convites e gestão de membros na interface, várias unidades, quantidades fracionárias, back-channel logout, observabilidade.
- D: PWA, política offline, fila local, instalação em intranet com TLS, backup e restauração ensaiada.
- E: fornecedores, compras/cotações, POS, fiscal, rastreabilidade e inteligência com dados reais.

Nenhum deploy público de produção deve ocorrer sem autorização do responsável.

## Licença e origem

Originado como projeto acadêmico de João Pedro, em 2026. A versão original permanece no histórico e em legacy/. [LICENSE](LICENSE) mantém integralmente a licença MIT e Copyright (c) 2026 João Pedro. A evolução comercial não revoga direitos concedidos anteriormente; mantenha aviso de copyright e licença em cópias ou partes substanciais.
