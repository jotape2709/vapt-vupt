# Vapt-Vupt Next

Uma nova base de gestão para mercados, adegas, bares e pequenos estabelecimentos. Reconstrução progressiva do projeto acadêmico Vapt-Vupt, com foco em clareza operacional, identidade por empresa e fundamentos seguros.

**Estado: desenvolvimento. Não pronto para produção.** O site oferece uma demonstração com empresas fictícias e uma área conectada em desenvolvimento, acessível por OIDC quando a instalação é configurada. O fluxo com um provedor real ainda precisa de homologação. Não há clientes, indicadores comerciais ou conformidade certificada anunciados.

## O que existe nesta branch

| Experiência | Estado real |
|---|---|
| Site público e nova identidade VV | Código React/CSS e ativos SVG |
| Mercado Aurora, Adega Vértice, Bar da Esquina | Empresas fictícias com catálogos e temas distintos |
| Busca, filtros, cadastro de produtos, entradas/saídas | Funcionais na demonstração local; histórico só na sessão |
| Nome, logo, paleta, claro/escuro, densidade, fonte, módulos | Preferências por empresa no navegador; prévia e salvamento |
| Onboarding | Cria ambiente fictício local, sem conta comercial |
| Compras, cotações e equipe | Estados explicativos; nenhuma operação externa |
| API Fastify e PostgreSQL | Código de autenticação por token OIDC, membership, RLS, produtos, tema, movimentações, auditoria |
| Área conectada: OIDC/PKCE, empresas autorizadas, estoque, cadastro e movimentos | Implementada em código; depende de provedor, API e banco configurados; homologação real pendente |
| Cadastro comercial de organizações, convites e administração central | Ainda não implementados |
| GTIN, embalagens, lotes, validade, depósitos, POS | Planejados |
| PWA instalável, cache, fila IndexedDB, Docker/intranet pronta | Não implementados; fase D depende da conclusão da base C |

## Desenvolvimento

Node.js 22.12+ e npm. Trabalhe na branch de reconstrução:

```bash
git clone https://github.com/jotape2709/vapt-vupt.git
cd vapt-vupt
git switch next/foundation-product
npm ci
npm run dev
```

Abra o endereço local informado pelo Vite. Entre em **Explorar demonstração**. Troque entre as três empresas no seletor; em Personalização, altere o tema e salve. Cadastre produto e registre entrada/saída para testar o saldo. Nenhuma credencial é solicitada.

```bash
npm run lint
npm run build
npm test
npm run preview
# Testes de navegador (após build)
npx playwright install chromium
npm run test:browser
```

O build publica somente index.html transformado, código compilado e public/. Não sirva a raiz do repositório: legacy/ contém código antigo inseguro e é apenas referência histórica.

**Dependências:** package-lock.json registra as versões resolvidas e testadas. Use npm ci. A auditoria npm audit passou sem vulnerabilidades reportadas na execução documentada. Um override de minimatch 11.0.1 corrige o alerta transitivo do parser de lint; revisar esse override ao atualizar a ferramenta.

## API, identidade e banco

1. Provisione PostgreSQL e um provedor OIDC confiável.
2. Use uma conta de migração dedicada (002 exige BYPASSRLS para migrar todos os temas) e outra de runtime, sem superusuário, bypass RLS ou ownership. Nunca utilize a conta de migração na API.
3. Copie .env.example para .env e substitua os placeholders. Os comandos não carregam .env automaticamente; exporte as variáveis no processo ou use o suporte --env-file do runtime.
4. Execute `npm run db:migrate` com MIGRATION_DATABASE_URL. A migration é transacional e registra versão.
5. Aplique os grants comentados em db/migrations/001_core.sql ao papel real.
6. Provisione organização, unidade e membership via administração do banco. **Não há endpoint público de cadastro de organizações nesta fase.**
7. Configure o cliente público OIDC e o proxy descritos em [docs/CONNECTED_ACCESS.md](docs/CONNECTED_ACCESS.md).
8. Execute `npm run dev:api` com DATABASE_URL, OIDC_ISSUER, OIDC_AUDIENCE e OIDC_JWKS_URL configurados.

A API falha ao iniciar se configuração de identidade estiver ausente. /health mede somente o processo. Rotas sob /api/organizations/:orgId exigem Bearer OIDC válido e membership. GET /api/me/organizations lista somente empresas da identidade verificada. GET/POST products, PUT theme e GET/POST movements estão definidos. Movimentação exige UUID de evento, produto, expectedVersion, kind, quantity inteira e reason. Conflitos retornam 409; nenhuma correção silenciosa.

## Arquitetura

- apps/web: React, TypeScript e Vite; site, demo e área conectada; oidc-client-ts para Authorization Code + PKCE.
- apps/api: Fastify, jose, PostgreSQL; validação Zod, headers e rate limiting.
- packages/domain: contratos de tema, produto, movimentação e políticas.
- db/migrations: SQL versionado, RLS e chaves por organização.
- tests: testes de domínio, API e integração com banco descartável.
- docs: auditoria, decisões, identidade, segurança e validação.
- legacy: versão acadêmica preservada, fora do build.

## Testes e limites

`npm test` roda testes unitários/API e **pula integração PostgreSQL** se TEST_ADMIN_DATABASE_URL não estiver definida. A integração cria papel e dados: só executar em banco descartável recém-migrado, nunca num banco de produção. O workflow Next foundation checks prevê PostgreSQL efêmero e execução de lint, build, migration e testes.

Veja [docs/VALIDATION.md](docs/VALIDATION.md) para distinguir checks escritos de resultados realmente executados. Código e testes escritos não equivalem a testes aprovados.

## Segurança e dados

Demo usa localStorage apenas para preferências e dados fictícios, não como autenticação. Não inserir dados pessoais reais. Tema não controla autorização. API valida tokens via provedor externo e membership no banco; RLS depende de papel configurado corretamente. Eventos têm idempotência e controle de versão. Histórico demo não é trilha de auditoria. Estoque por unidade, quantidades fracionárias e armazenamento comercial de logos ainda pendentes.

Leia [Segurança](docs/SECURITY.md), [Arquitetura](docs/ARCHITECTURE.md), [Auditoria](docs/AUDIT.md) e [Identidade](docs/BRAND.md).

## Roadmap

- A: auditoria, separação do legado, contratos, migrations e testes executados no CI.
- B: nova identidade e experiência demonstrativa; fluxos testados em desktop e celular; revisão visual completa e leitores de tela pendentes.
- C: homologar UI/OIDC/API com provedor real; implementar onboarding seguro, gestão de membros, administração central e logos remotos.
- D: PWA, política offline, IndexedDB, conflitos, servidor intranet, TLS, backups, atualização e ensaios de restauração.
- E: fornecedores, compras/cotações reais, POS, rastreabilidade e inteligência com dados reais.

Nenhum deploy público de produção deve ocorrer sem autorização do responsável.


## Continuar com Claude ou Antigravity

Leia [docs/context/START_HERE.md](docs/context/START_HERE.md). A branch inclui AGENTS.md, CLAUDE.md, regra de workspace para Antigravity, estado do produto, backlog, mapa de fontes e recuperação local por tarefa.

```bash
npm run context:check
npm run context:search -- "replay idempotência estoque"
npm run context:pack -- "replay idempotência estoque"
```

O pacote fica em `.context/context-pack.md` e deve ser lido pelo agente. Sem API paga, embeddings ou servidor adicional para a recuperação. É busca lexical/estrutural assistindo o agente, não uma implementação ou treinamento do STAIR da IBM. Ao mudar os fontes, revise o estado manual e execute `npm run context:snapshot` antes do commit.

## Licença e origem

Originado como projeto acadêmico de João Pedro, em 2026. A versão original permanece no histórico e em legacy/. [LICENSE](LICENSE) mantém integralmente a licença MIT e Copyright (c) 2026 João Pedro. A evolução comercial não revoga direitos concedidos anteriormente; mantenha aviso de copyright e licença em cópias ou partes substanciais.
